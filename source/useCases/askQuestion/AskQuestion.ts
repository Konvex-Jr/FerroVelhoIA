import { ModelType } from "../../domain/Enums/ModelType";
import { TokenType } from "../../domain/Enums/TokenType";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import AskQuestionInput from "./AskQuestionInput";
import AskQuestionOutput from "./AskQuestionOutput";
import ChunkService from "../../domain/Services/ChunkService";
import { SYSTEM_PROMPT } from "../../domain/Enums/SystemPrompts";
import GeminiChatService from "../../domain/Services/GeminiChatService";
import ChatHistoryService from "../../domain/Services/ChatHistoryService";
import removeStopwordsService from "../../domain/Services/removeStopwordsService";

export default class AskQuestion {
    private repositoryFactory: RepositoryFactoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    private chunkService: ChunkService;
    private chatService: GeminiChatService;
    private chatHistoryService: ChatHistoryService;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        chunkService?: ChunkService,
        chatService?: GeminiChatService,
        chatHistoryService?: ChatHistoryService
    ) {
        this.repositoryFactory = repositoryFactory;
        this.tokenRepository = repositoryFactory.createTokenRepository();
        
        this.chunkService = chunkService || new ChunkService(this.repositoryFactory);
        this.chatHistoryService = chatHistoryService || new ChatHistoryService(this.repositoryFactory);
        
        this.chatService = chatService || new GeminiChatService(this.repositoryFactory, this.chatHistoryService);
    }

    async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
        if (!input.question) throw new Error("O campo pergunta é obrigatório.");

        const combinedText = input.question;
        const cleanedText = await removeStopwordsService(combinedText, "porBr");

        const queryEmbedding = await this.chatService.generateEmbedding(
            cleanedText
        );

        const topChunks = await this.chunkService.findRelevantChunks(queryEmbedding);

        const systemPrompt = SYSTEM_PROMPT;

        const userPrompt = `
            Contexto:
            ${topChunks.map(c => c.chunk).join("\n\n")}

            Pergunta:
            ${input.question}
        `;

        let conversation;
        if (input.conversationId) {
            conversation = await this.chatHistoryService.getConversationById(input.conversationId);
            if (!conversation) throw new Error("Conversa não encontrada.");
        } else {
            conversation = await this.chatHistoryService.createConversation(input.userId, `Conversa ${input.userId}`);
        }

        const answer = await this.chatService.chatWithConversation(
            conversation,
            ModelType.PROMPT_MODEL,
            systemPrompt,
            userPrompt
        );

        return { answer, conversationId: conversation.id };
    }
}