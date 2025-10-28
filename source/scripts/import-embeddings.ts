import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import RepositoryFactoryInterface from "../domain/Interfaces/RepositoryFactoryInterface";
import ChunkRepositoryInterface from "../domain/Interfaces/ChunkRepositoryInterface";
import { ModelType } from "../domain/Enums/ModelType";
import { TokenType } from "../domain/Enums/TokenType";
import { cosineSimilarity } from "../domain/Services/CosineSimilarity";
import { encoding_for_model } from "tiktoken";
import RemoveStopWordsService from "../domain/Services/removeStopwordsService";

export default class ImportEmbeddings {
  private repositoryFactory: RepositoryFactoryInterface;
  private chunkRepository: ChunkRepositoryInterface;
  private gemini: GoogleGenerativeAI;

  constructor(repositoryFactory: RepositoryFactoryInterface, gemini?: GoogleGenerativeAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está definida no .env");
    }

    this.repositoryFactory = repositoryFactory;
    this.chunkRepository = repositoryFactory.createChunkRepository();
    this.gemini = gemini || new GoogleGenerativeAI(apiKey);
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
          try {
            emb = JSON.parse(emb);
          } catch {}
        }
        return { ...ec, embedding: emb };
      });

      // Modelo de embeddings Gemini
      const embeddingModel = this.gemini.getGenerativeModel({
        model: ModelType.EMBEDDING_MODEL, // 'embedding-001'
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i].trim();
        if (!chunkText) continue;

        try {
          // 👉 Gerando embedding diretamente do SDK do Gemini
          const result = await embeddingModel.embedContent(chunkText);
          const embedding = result.embedding?.values;

          if (!Array.isArray(embedding) || embedding.length === 0) continue;

          // Verifica duplicidade com base em similaridade
          const isDuplicate = existingChunks.some((ec: any) => {
            try {
              return (
                Array.isArray(ec.embedding) &&
                cosineSimilarity(ec.embedding, embedding) > 0.9
              );
            } catch {
              return false;
            }
          });

          if (isDuplicate) continue;

          const created = await this.chunkRepository.create({
            fileName,
            chunk: chunkText,
            embedding,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          if (created) existingChunks.push({ ...created, embedding });
        } catch (err: any) {
          console.error(`Erro ao gerar embedding para chunk: ${fileName}`, err.message);
        }
      }
    }
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  private splitIntoChunks(paragraphs: string[], maxTokens: number): string[] {
    const encoder = encoding_for_model("gpt-3.5-turbo"); // usado apenas para contar tokens
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
