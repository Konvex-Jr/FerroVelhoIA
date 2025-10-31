import OpenAI from "openai";
import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";
import ChatHistoryService from "./ChatHistoryService";
import Conversation from "../Entity/Conversation";
import Message from "../Entity/Message";

export default class OpenAIChatService {
    private openai: OpenAI;
    private tokenRepository: TokenRepositoryInterface;
    private chatHistoryService: ChatHistoryService;

    constructor(repositoryFactory: RepositoryFactoryInterface, chatHistoryService: ChatHistoryService, openai?: OpenAI) {
        this.openai = openai || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.tokenRepository = repositoryFactory.createTokenRepository();
        this.chatHistoryService = chatHistoryService;
    }

    async chatWithConversation(
        conversation: Conversation,
        model: ModelType,
        systemPrompt: string,
        userPrompt: string
    ): Promise<string> {
        const previousMessages: Message[] = await this.chatHistoryService.getChatHistory(conversation.id);

        const formattedMessages = previousMessages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        formattedMessages.push({ role: "user", content: userPrompt });

        const response = await this.openai.chat.completions.create({
            model,
            messages: formattedMessages,
        });

        const reply = response.choices[0].message?.content || "";

        await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
        await this.chatHistoryService.addMessage(conversation.id, "assistant", reply);

        const tokensUsed = response.usage?.total_tokens || 0;
        const token = new Token(model, TokenType.OUTPUT, tokensUsed);
        await this.tokenRepository.create(token);

        return reply;
    }
}