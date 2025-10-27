import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { OpenAI } from "openai";
import RepositoryFactoryInterface from "../domain/Interfaces/RepositoryFactoryInterface";
import ChunkRepositoryInterface from "../domain/Interfaces/ChunkRepositoryInterface";
import EmbeddingService from "../domain/Services/EmbeddingService";
import { ModelType } from "../domain/Enums/ModelType";
import { TokenType } from "../domain/Enums/TokenType";
import { cosineSimilarity } from "../domain/Services/CosineSimilarity";
import { encoding_for_model } from "tiktoken";
import RemoveStopWordsService from "../domain/Services/removeStopwordsService";

export default class ImportEmbeddings {
    private repositoryFactory: RepositoryFactoryInterface;
    private chunkRepository: ChunkRepositoryInterface;
    private embeddingService: EmbeddingService;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        openai: OpenAI,
        embeddingService?: EmbeddingService
    ) {
        this.repositoryFactory = repositoryFactory;
        this.chunkRepository = repositoryFactory.createChunkRepository();
        this.embeddingService =
            embeddingService || new EmbeddingService(this.repositoryFactory, openai);
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
            const filePath = path.join(resolvedPath, fileName);

            let buffer: Buffer;
            try {
                buffer = fs.readFileSync(filePath);
            } catch {
                continue;
            }

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
            } catch {
                continue;
            }

            if (!text.trim()) continue;

            const cleanedText = await RemoveStopWordsService(text, lang);
            const paragraphs = this.splitIntoParagraphs(cleanedText);
            const chunks = this.splitIntoChunks(paragraphs, 500);

            const existingChunksRaw = await this.chunkRepository.getAll();
            const existingChunks = existingChunksRaw.map((ec: any) => {
                let emb = ec.embedding;
                if (typeof emb === "string") {
                    try { emb = JSON.parse(emb); } catch {}
                }
                return { ...ec, embedding: emb };
            });

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i].trim();
                if (!chunkText) continue;

                try {
                    const embedding = await this.embeddingService.createEmbedding(
                        chunkText,
                        ModelType.EMBEDDING_MODEL,
                        TokenType.EMBEDDING
                    );

                    if (!Array.isArray(embedding) || embedding.length === 0) continue;

                    const isDuplicate = existingChunks.some((ec: any) => {
                        try { return Array.isArray(ec.embedding) && cosineSimilarity(ec.embedding, embedding) > 0.9; }
                        catch { return false; }
                    });

                    if (isDuplicate) continue;

                    const created = await this.chunkRepository.create({
                        fileName,
                        chunk: chunkText,
                        embedding: embedding,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    if (created) existingChunks.push({ ...created, embedding });
                } catch {}
            }
        }
    }

    private splitIntoParagraphs(text: string): string[] {
        return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    }

    private splitIntoChunks(paragraphs: string[], maxTokens: number): string[] {
        const encoder = encoding_for_model(ModelType.EMBEDDING_MODEL);
        const chunks: string[] = [];
        let currentChunk = "";
        let currentTokenCount = 0;

        for (const paragraph of paragraphs) {
            const paragraphTokens = encoder.encode(paragraph);
            const paragraphTokenCount = paragraphTokens.length;

            if (paragraphTokenCount > maxTokens) {
                const words = paragraph.split(/\s+/);
                let tempChunk = "";
                let tempTokenCount = 0;

                for (const word of words) {
                    const wordTokens = encoder.encode(word);
                    if (tempTokenCount + wordTokens.length > maxTokens) {
                        if (tempChunk) chunks.push(tempChunk);
                        tempChunk = word;
                        tempTokenCount = wordTokens.length;
                    } else {
                        tempChunk += (tempChunk ? " " : "") + word;
                        tempTokenCount += wordTokens.length;
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
        encoder.free();
        return chunks;
    }

}
