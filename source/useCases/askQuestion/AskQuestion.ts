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
import { TinyRepositoryInterface } from "../../domain/Interfaces/TinyRepositoryInterface";

export default class AskQuestion {
    private repositoryFactory: RepositoryFactoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    private chunkService: ChunkService;
    private chatService: GeminiChatService;
    private chatHistoryService: ChatHistoryService;
    private tinyRepository: TinyRepositoryInterface;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        chunkService?: ChunkService,
        chatService?: GeminiChatService,
        chatHistoryService?: ChatHistoryService,
        tinyRepository?: TinyRepositoryInterface
    ) {
        this.repositoryFactory = repositoryFactory;
        this.tokenRepository = repositoryFactory.createTokenRepository();
        this.chunkService = chunkService || new ChunkService(this.repositoryFactory);
        this.chatHistoryService = chatHistoryService || new ChatHistoryService(this.repositoryFactory);

        this.tinyRepository = tinyRepository || repositoryFactory.createTinyRepository();

        this.chatService = chatService || new GeminiChatService(
            this.repositoryFactory,
            this.chatHistoryService
        );
    }

    async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
        if (!input.question) throw new Error("O campo pergunta é obrigatório.");

        const cleanedText = await removeStopwordsService(input.question, "por");

        const queryEmbedding = await this.chatService.generateEmbedding(cleanedText);
        const topChunks = await this.chunkService.findRelevantChunks(queryEmbedding);
        const contextRAG = topChunks.map(c => c.chunk).join("\n\n");

        const products = await this.tinyRepository.findProductsByName(queryEmbedding);
        const contextProducts = products.length > 0
            ? JSON.stringify(products)
            : "Nenhum produto relevante encontrado no banco de dados local para esta pergunta.";

        // 5. Montar o Prompt (O seu SYSTEM_PROMPT e userPrompt já estão corretos)
        const systemPrompt = SYSTEM_PROMPT;
        const userPrompt = `
--- CONTEXTO DE PRODUTOS (Preços/Estoque do Banco de Dados) ---
${contextProducts}

--- CONTEXTO GERAL (Informações da Empresa) ---
${contextRAG}
---
Instrução: Baseie sua resposta **estritamente** nos contextos fornecidos acima.

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