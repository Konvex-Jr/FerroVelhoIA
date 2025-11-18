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
import ProductRepository from "../../infra/repository/ProductRepository"; // Importe o Repositório
import { randomUUID } from "crypto";

export default class AskQuestion {
    private repositoryFactory: RepositoryFactoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    private chunkService: ChunkService;
    private chatService: GeminiChatService;
    private chatHistoryService: ChatHistoryService;
    private tinyClient: TinyClientService;
    private productRepository: ProductRepository; // Nova propriedade

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

        const token = process.env.TINY_API_TOKEN;
        if (!token && !tinyClient) throw new Error("TINY_API_TOKEN não configurado.");
        this.tinyClient = tinyClient || new TinyClientService(token || '');

        this.chatService = chatService || new GeminiChatService(
            this.repositoryFactory,
            this.chatHistoryService
        );

        this.productRepository = new ProductRepository(
            repositoryFactory.createConnection(),
            this.chatService
        );
    }

    async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
        if (!input.question) throw new Error("O campo pergunta é obrigatório.");

        if (!input.userId) {
            input.userId = randomUUID();
        } else {
            input.userId = String(input.userId);
        }


        const cleanedText = await removeStopwordsService(input.question, "por");
        const queryEmbedding = await this.chatService.generateEmbedding(cleanedText);
        const topChunks = await this.chunkService.findRelevantChunks(queryEmbedding);

        let productsContext = "";
        try {
            const foundProducts = await this.productRepository.findProductsByVector(input.question);

            if (foundProducts.length > 0) {
                productsContext = `
                FERRAMENTA DE ESTOQUE (Use estes dados com prioridade para responder sobre preços e disponibilidade):
                ${foundProducts.map(p =>
                    `- Produto: ${p.name} | SKU: ${p.sku} | Preço: R$ ${p.price.toFixed(2)} | Estoque ATUAL: ${p.quantity} unidades.`
                ).join("\n")}
                `;
            } else {
                productsContext = "Nenhum produto similar encontrado no estoque.";
            }
        } catch (e) {
            console.error("Erro ao buscar produtos:", e);
            productsContext = "Erro ao consultar sistema de estoque.";
        }

        const systemPrompt = SYSTEM_PROMPT;

        const userPrompt = `
            Contexto de Documentos (Políticas/Infos Gerais):
            ${topChunks.map(c => c.chunk).join("\n\n")}

            ${productsContext}

            Pergunta do Usuário:
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