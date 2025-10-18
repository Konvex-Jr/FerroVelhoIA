import OpenAI from "openai";
import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";

export default class OpenAIChatService {
    private openai: OpenAI;
    private tokenRepository: TokenRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface, openai?: OpenAI) {
        this.openai = openai || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.tokenRepository = repositoryFactory.createTokenRepository();
    }

    async chatWithContext(
        model: ModelType,
        systemPrompt: string,
        userPrompt: string,
    ): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });

        const tokensUsed = response.usage?.total_tokens || 0;
        const token = new Token(model, TokenType.OUTPUT, tokensUsed);
        await this.tokenRepository.create(token);

        return response.choices[0].message?.content || "";
    }
}
