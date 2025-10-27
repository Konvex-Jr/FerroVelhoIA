import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import { GoogleGenerativeAI } from "@google/generative-ai";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";

export default class EmbeddingService {
    readonly tokenRepository: TokenRepositoryInterface;
    private gemini: GoogleGenerativeAI;

    constructor(repositoryFactory: RepositoryFactoryInterface, gemini: GoogleGenerativeAI) {
        this.tokenRepository = repositoryFactory.createTokenRepository();
        this.gemini = gemini;
    }

    async createEmbedding(text: string, model: ModelType, tokenType: TokenType): Promise<number[]> {

        const embeddingModel = this.gemini.getGenerativeModel({ model: "embedding-001" });

        const response = await embeddingModel.embedContent(text);
        const embedding = response.embedding.values;

        const tokensUsed = text.length;
        const token = new Token(model, tokenType, tokensUsed);
        await this.tokenRepository.create(token);

        return embedding;
    }
}