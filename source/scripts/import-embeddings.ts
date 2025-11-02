import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import RepositoryFactoryInterface from "../domain/Interfaces/RepositoryFactoryInterface";
import ChunkRepositoryInterface from "../domain/Interfaces/ChunkRepositoryInterface";
import { ModelType } from "../domain/Enums/ModelType";
import { cosineSimilarity } from "../domain/Services/CosineSimilarity";
import RemoveStopWordsService from "../domain/Services/removeStopwordsService";
import GeminiChatService from "../domain/Services/GeminiChatService"; 
import ChatHistoryService from "../domain/Services/ChatHistoryService"; 
import Chunk from "../domain/Entity/Chunk";

export default class ImportEmbeddings {
    private repositoryFactory: RepositoryFactoryInterface;
    private chunkRepository: ChunkRepositoryInterface;
    private chatService: GeminiChatService;
    private model: GenerativeModel;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
    ) {
        this.repositoryFactory = repositoryFactory;
        this.chunkRepository = repositoryFactory.createChunkRepository();

        const chatHistoryService = new ChatHistoryService(repositoryFactory);
        this.chatService = new GeminiChatService(repositoryFactory, chatHistoryService);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY não definida");
        const gemini = new GoogleGenerativeAI(apiKey);
        this.model = gemini.getGenerativeModel({ model: ModelType.EMBEDDING_MODEL });
    }

    async run(inputFolder: string = "./docs", lang: string = "por"): Promise<void> {
        const resolvedPath = path.resolve(inputFolder);

        if (!fs.existsSync(resolvedPath)) {
            fs.mkdirSync(resolvedPath, { recursive: true });
        }

        const files = fs
            .readdirSync(resolvedPath)
            .filter((f) => f.endsWith(".pdf") || f.endsWith(".txt") || f.endsWith(".docx"));

        if (files.length === 0) return;

        for (const fileName of files) {
            let buffer: Buffer;
            try {
                buffer = fs.readFileSync(path.join(resolvedPath, fileName));
            } catch { continue; }

            let text = "";
            try {
                if (fileName.endsWith(".pdf")) {
                    const data = await pdf(buffer);
                    text = data.text || "";
                } else if (fileName.endsWith(".docx")) {
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value || "";
                } else {
                    text = buffer.toString("utf-8");
                }
            } catch { continue; }
            
            if (!text.trim()) continue;
            
            const cleanedText = await RemoveStopWordsService(text, lang);
            const paragraphs = this.splitIntoParagraphs(cleanedText);
            
            const chunks = await this.splitIntoChunks(paragraphs, 500);

            const existingChunks = await this.chunkRepository.getAll();

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i].trim();
                if (!chunkText) continue;

                try {
                    const embedding = await this.chatService.generateEmbedding(
                        chunkText
                    );

                    if (!Array.isArray(embedding) || embedding.length === 0) continue;

                    const isDuplicate = existingChunks.some((ec: Chunk) => {
                        try {
                            return Array.isArray(ec.embedding) && cosineSimilarity(ec.embedding, embedding) > 0.9;
                        } catch { return false; }
                    });

                    if (isDuplicate) continue;

                    const newChunk = new Chunk(fileName, chunkText, embedding);
                    await this.chunkRepository.create(newChunk);

                    existingChunks.push(newChunk);

                } catch (e) {
                    console.error("Erro ao processar chunk:", e);
                }
            }
        }
    }

    private splitIntoParagraphs(text: string): string[] {
        return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    }

    private async splitIntoChunks(paragraphs: string[], maxTokens: number): Promise<string[]> {
        const chunks: string[] = [];
        let currentChunk = "";
        let currentTokenCount = 0;

        for (const paragraph of paragraphs) {
            const { totalTokens: paragraphTokenCount } = await this.model.countTokens(paragraph);

            if (paragraphTokenCount > maxTokens) {
                const words = paragraph.split(/\s+/);
                let tempChunk = "";
                let tempTokenCount = 0;

                for (const word of words) {
                    const { totalTokens: wordTokenCount } = await this.model.countTokens(word);
                    if (tempTokenCount + wordTokenCount > maxTokens) {
                        if (tempChunk) chunks.push(tempChunk);
                        tempChunk = word;
                        tempTokenCount = wordTokenCount;
                    } else {
                        tempChunk += (tempChunk ? " " : "") + word;
                        tempTokenCount += wordTokenCount;
                    }
                }
                if (tempChunk) chunks.push(tempChunk);
                continue;
            }

            if (currentTokenCount + paragraphTokenCount > maxTokens) {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = paragraph;
                currentTokenCount = paragraphTokenCount;
            } else {
                currentChunk += (currentChunk ? " " : "") + paragraph;
                currentTokenCount += paragraphTokenCount;
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }
}