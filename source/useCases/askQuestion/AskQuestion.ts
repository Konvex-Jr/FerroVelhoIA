import { ModelType } from "../../domain/Enums/ModelType";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import AskQuestionInput from "./AskQuestionInput";
import AskQuestionOutput from "./AskQuestionOutput";
import ChunkService from "../../domain/Services/ChunkService";
import { SYSTEM_PROMPT } from "../../domain/Enums/SystemPrompts";
import GeminiChatService from "../../domain/Services/GeminiChatService";
import ChatHistoryService from "../../domain/Services/ChatHistoryService";
import removeStopwordsService from "../../domain/Services/removeStopwordsService";
import TinyClientService from "../../infra/clients/TinyClient"; 
import { randomUUID } from "crypto";

export default class AskQuestion {
    private repositoryFactory: RepositoryFactoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    private chunkService: ChunkService;
    private chatService: GeminiChatService;
    private chatHistoryService: ChatHistoryService;
    private tinyClient: TinyClientService; 

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        chunkService?: ChunkService,
        chatService?: GeminiChatService,
        chatHistoryService?: ChatHistoryService,
        
        tinyClient?: TinyClientService 
    ) {
        this.repositoryFactory = repositoryFactory;
        this.tokenRepository = repositoryFactory.createTokenRepository();
        this.chunkService = chunkService || new ChunkService(this.repositoryFactory);
        this.chatHistoryService = chatHistoryService || new ChatHistoryService(this.repositoryFactory);
        
        this.tinyClient = tinyClient || new TinyClientService(process.env.TINY_API_TOKEN || '');
        
        this.chatService = chatService || new GeminiChatService(
            this.repositoryFactory, 
            this.chatHistoryService,
            this.tinyClient 
        );
    }

    async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
        if (!input.question) throw new Error("O campo pergunta é obrigatório.");
        
        if (!input.userId) input.userId = randomUUID();
        else{
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if(!uuidRegex.test(input.userId)) {
            input.userId = String(input.userId);
            }

        }


        const cleanedText = await removeStopwordsService(input.question, "por");
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