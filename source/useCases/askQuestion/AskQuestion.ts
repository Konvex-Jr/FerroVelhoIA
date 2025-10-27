import { GoogleGenerativeAI } from "@google/generative-ai";
import { ModelType } from "../../domain/Enums/ModelType";
import { TokenType } from "../../domain/Enums/TokenType";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import { extractPdfText } from "../../domain/Services/extractTextFromPDF";
import AskQuestionInput from "./AskQuestionInput";
import AskQuestionOutput from "./AskQuestionOutput";
import EmbeddingService from "../../domain/Services/EmbeddingService";
import ChunkService from "../../domain/Services/ChunkService";
import GeminiChatService from "../../domain/Services/GeminiChatService";
import ChatHistoryService from "../../domain/Services/ChatHistoryService";
import Conversation from "../../domain/Entity/Conversation";
import { SYSTEM_PROMPT } from "../../domain/Enums/SystemPrompt";

//@ts-ignore
import removeStopwordsService from "../../domain/Services/removeStopwordsService";

export default class AskQuestion {

    private repositoryFactory: RepositoryFactoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    private embeddingService: EmbeddingService;
    private chunkService: ChunkService;
    private chatService: GeminiChatService;
    private chatHistoryService?: ChatHistoryService;

    constructor(
        repositoryFactory: RepositoryFactoryInterface,
        embeddingService?: EmbeddingService,
        chunkService?: ChunkService,
        chatService?: GeminiChatService,
        chatHistoryService?: ChatHistoryService
    ) {
        this.repositoryFactory = repositoryFactory;
        this.tokenRepository = repositoryFactory.createTokenRepository();
        this.chatHistoryService = chatHistoryService;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
        throw new Error("GEMINI_API_KEY não está definida nas variáveis de  ambiente (.env)");
        }

        const gemini = new GoogleGenerativeAI(apiKey);

        this.embeddingService = embeddingService || new EmbeddingService(this.repositoryFactory, gemini);
    
        this.chunkService = chunkService || new ChunkService(this.repositoryFactory);
    
        this.chatService = chatService || new GeminiChatService(this.repositoryFactory, gemini);

    }

    async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
        if (!input.question) throw new Error("O campo pergunta é obrigatório.");
        let question = await removeStopwordsService(input.question, "porBr");
        let fileText = "";
        if (input.file) {
            const file = input.file as Express.Multer.File;
            if (file.mimetype !== "application/pdf")
                throw new Error("Formato inválido. Apenas PDF é aceito.");
            if (file.size > 1_000_000)
                throw new Error("O arquivo PDF deve ter menos de 1MB.");
            fileText = await extractPdfText(file);
            fileText = await removeStopwordsService(fileText, "porBr");
        }
        const combinedText = [fileText, question].filter(Boolean).join(" ");
        const queryEmbedding = await this.embeddingService.createEmbedding(combinedText, ModelType.PROMPT_MODEL, TokenType.INPUT);
        const topChunks = await this.chunkService.findRelevantChunks(queryEmbedding);
        const userPrompt = `
            Contexto:
            ${topChunks.map(c => c.chunk).join("\n\n")}

            Pergunta:
            ${question}
        `;
        let conversation: Conversation | null = null;
        if (this.chatHistoryService) {
            if (input.conversationId) {
                conversation = await this.chatHistoryService.getConversationById(input.conversationId);
            }
            if (!conversation) {
                conversation = await this.chatHistoryService.createConversation(input.userId);
            }
        }

        let answer: string;
        const conversationAwareService = conversation && typeof (this.chatService as unknown as { chatWithConversation?: Function }).chatWithConversation === "function";

        if (conversation && conversationAwareService) {
            answer = await (this.chatService as unknown as { chatWithConversation: (conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string) => Promise<string> })
                .chatWithConversation(conversation, ModelType.PROMPT_MODEL, SYSTEM_PROMPT, userPrompt);
        } else {
            if (conversation && this.chatHistoryService) {
                await this.chatHistoryService.addMessage(conversation.id, "user", question);
            }
            answer = await this.chatService.chatWithContext(ModelType.PROMPT_MODEL, SYSTEM_PROMPT, userPrompt);
            if (conversation && this.chatHistoryService) {
                await this.chatHistoryService.addMessage(conversation.id, "assistant", answer);
            }
        }

        return { answer, conversationId: conversation ? conversation.id : (input.conversationId || "")};
    }
}
