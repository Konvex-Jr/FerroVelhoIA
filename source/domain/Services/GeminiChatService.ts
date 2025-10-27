import { GoogleGenerativeAI } from "@google/generative-ai";
import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";

export default class GeminiChatService {
    private gemini: GoogleGenerativeAI;
    private tokenRepository!: TokenRepositoryInterface;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        gemini?: GoogleGenerativeAI
    ) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY não está definida nas variáveis de ambiente (.env)");
        }

        this.gemini = new GoogleGenerativeAI(apiKey);

    }

    async chatWithContext(
        model: ModelType,
        systemPrompt: string,
        userPrompt: string,
    ): Promise<string> {
        const generativeModel = this.gemini.getGenerativeModel({ model });

        const fullPrompt = `${systemPrompt}\n\nUsuário: ${userPrompt}`;

        const response = await generativeModel.generateContent(fullPrompt);

        const textResponse = response.response.text();

        const tokensUsed = 0;

        const token = new Token(model, TokenType.OUTPUT, tokensUsed);
        await this.tokenRepository.create(token);

        return textResponse;
    }
}