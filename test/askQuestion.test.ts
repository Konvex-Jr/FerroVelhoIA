import { ModelType } from "../source/domain/Enums/ModelType";
import { TokenType } from "../source/domain/Enums/TokenType";
import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import AskQuestion from "../source/useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../source/useCases/askQuestion/AskQuestionInput";
import 'dotenv/config';
import { extractPdfText } from '../source/domain/Services/extractTextFromPDF';
import ChatHistoryService from '../source/domain/Services/ChatHistoryService';

jest.mock('../source/domain/Services/extractTextFromPDF', () => ({
    extractPdfText: jest.fn().mockResolvedValue('Texto extraído do PDF'),
}));

class MockEmbeddingService {
    async createEmbedding(text: string, model: ModelType, tokenType: TokenType) {
        return [0.1, 0.2, 0.3];
    }
}

class MockChunkService {
    async findRelevantChunks(embedding: number[]) {
        return [{ chunk: "Chunk 1" }, { chunk: "Chunk 2" }];
    }
}

class MockChatService {
    private chatHistoryService: ChatHistoryService;
    constructor(chatHistoryService: ChatHistoryService) {
        this.chatHistoryService = chatHistoryService;
    }

    async chatWithConversation(conversation: any, model: ModelType, systemPrompt: string, userPrompt: string) {
        await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
        const simulatedAnswer = "Resposta simulada";
        await this.chatHistoryService.addMessage(conversation.id, "assistant", simulatedAnswer);
        return simulatedAnswer;
    }
}

describe("AskQuestion use case", () => {
    let askQuestion: AskQuestion;
    let repositoryFactory: RepositoryFactoryInterface;
    let chatHistoryService: ChatHistoryService;

    beforeEach(() => {
        repositoryFactory = new MemoryRepositoryFactory();
        chatHistoryService = new ChatHistoryService(repositoryFactory);
        const mockChatService = new MockChatService(chatHistoryService);

        askQuestion = new AskQuestion(
            repositoryFactory,
            new MockEmbeddingService() as any,
            new MockChunkService() as any,
            mockChatService as any,
            chatHistoryService
        );
    });

    test("Deve gerar resposta para pergunta válida", async () => {
        const input: AskQuestionInput = { 
            question: "Qual o impacto do ODS 4?",
            mentorType: "GENERATIVO",
            userId: "user-1"
        };
        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada");
        expect(output.conversationId).toBeDefined();
    });

    test("Deve falhar se o campo pergunta estiver vazio", async () => {
        const input: AskQuestionInput = { 
            question: "",
            mentorType: "GENERATIVO",
            userId: "user-1"
        };
        await expect(askQuestion.execute(input)).rejects.toThrow("O campo pergunta é obrigatório.");
    });

    test("Deve falhar se PDF inválido for enviado", async () => {
        const input: AskQuestionInput = {
            question: "Pergunta qualquer",
            mentorType: "REFLEXIVO",
            userId: "user-1",
            file: { mimetype: "text/plain", size: 500, buffer: Buffer.from("teste") } as any
        };
        await expect(askQuestion.execute(input)).rejects.toThrow("Formato inválido. Apenas PDF é aceito.");
    });

    test("Deve aceitar PDF válido", async () => {
        const input: AskQuestionInput = {
            question: "Pergunta com PDF",
            mentorType: "REFLEXIVO",
            userId: "user-1",
            file: {
                mimetype: "application/pdf",
                size: 500,
                originalname: "teste.pdf",
                buffer: Buffer.from("%PDF-1.4 fake content", "utf-8")
            } as Express.Multer.File
        };

        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada");
        expect(output.conversationId).toBeDefined();
    });

    test("Deve salvar e recuperar histórico de mensagens", async () => {
        const input1: AskQuestionInput = {
            question: "Primeira pergunta",
            mentorType: "GENERATIVO",
            userId: "user-2"
        };

        const output1 = await askQuestion.execute(input1);
        const conversationId = output1.conversationId;

        const input2: AskQuestionInput = {
            question: "Segunda pergunta",
            mentorType: "GENERATIVO",
            userId: "user-2",
            conversationId
        };

        const output2 = await askQuestion.execute(input2);

        const history = await chatHistoryService.getChatHistory(conversationId);

        expect(history.length).toBe(4);
        expect(history[0].role).toBe("user");
        expect(history[1].role).toBe("assistant");
        expect(history[2].role).toBe("user");
        expect(history[3].role).toBe("assistant");
    });
});
