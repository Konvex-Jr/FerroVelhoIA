import { ModelType } from "../source/domain/Enums/ModelType";
import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import AskQuestion from "../source/useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../source/useCases/askQuestion/AskQuestionInput";
import 'dotenv/config';
import ChatHistoryService from '../source/domain/Services/ChatHistoryService';
import Conversation from "../source/domain/Entity/Conversation";
import { LocalTinyProduct, TinyRepositoryInterface } from "../source/domain/Interfaces/TinyRepositoryInterface";

// --- MOCKS ATUALIZADOS ---

class MockChunkService {
    async findRelevantChunks(embedding: number[]): Promise<{ chunk: string }[]> {
        return [{ chunk: "Contexto RAG (horário de funcionamento...)" }];
    }
}

// CORRIGIDO: Este mock agora implementa a interface corretamente
// e sempre retorna o produto de teste.
class MockTinyRepository implements TinyRepositoryInterface {
    async findProductsByName(queryVector: number[]): Promise<LocalTinyProduct[]> {
        // Simula a busca vetorial retornando o produto
        return [
            { id: "123", name: "CONJUNTO DE COXINS", price: 120.50, quantity: 50 }
        ];
    }
    // Métodos restantes da interface (necessários para compilar)
    async saveProductWithVector(product: LocalTinyProduct): Promise<void> { }
    async updateStock(productId: string | number, quantity: number, depositCode: string): Promise<void> { }
    async getLastSync(key: string): Promise<string | null> { return null; }
    async setLastSync(key: string, value: string): Promise<void> { }
    async getStateNumber(key: string, fallback: number): Promise<number> { return fallback; }
    async setState(key: string, value: string): Promise<void> { }
}

class MockChatService {
    private chatHistoryService: ChatHistoryService;

    constructor(chatHistoryService: ChatHistoryService) {
        this.chatHistoryService = chatHistoryService;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Retorna o embedding falso esperado
        return [0.1, 0.2, 0.3];
    }

    async chatWithConversation(conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string) {
        await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);

        let simulatedAnswer = "Resposta simulada genérica.";

        // CORRIGIDO: O mock agora verifica se o nome do produto (do MockTinyRepository)
        // e o contexto do RAG (do MockChunkService) estão no prompt.
        if (userPrompt.includes("CONJUNTO DE COXINS") && userPrompt.includes("Contexto RAG")) {
            simulatedAnswer = "O CONJUNTO DE COXINS custa R$ 120,50 e nosso horário é...";
        }

        await this.chatHistoryService.addMessage(conversation.id, "model", simulatedAnswer);
        return simulatedAnswer;
    }
}

// --- TEST SUITE ---

describe("AskQuestion use case (Nova Arquitetura RAG + DB)", () => {
    let askQuestion: AskQuestion;
    let repositoryFactory: RepositoryFactoryInterface;
    let chatHistoryService: ChatHistoryService;
    let mockTinyRepository: MockTinyRepository; // Mantido

    beforeEach(() => {
        repositoryFactory = new MemoryRepositoryFactory();
        chatHistoryService = new ChatHistoryService(repositoryFactory);

        const mockChatService = new MockChatService(chatHistoryService);
        const mockChunkService = new MockChunkService();
        mockTinyRepository = new MockTinyRepository(); // Usa o mock corrigido

        askQuestion = new AskQuestion(
            repositoryFactory,
            mockChunkService as any,
            mockChatService as any,
            chatHistoryService,
            mockTinyRepository as any
        );
    });

    test("Deve gerar resposta para pergunta válida (usando RAG e DB)", async () => {
        const input: AskQuestionInput = {
            question: "Qual o preço do coxim e o horário de funcionamento?",
            userId: "user-1",
        };

        const spy = jest.spyOn(mockTinyRepository, 'findProductsByName');
        const expectedEmbedding = [0.1, 0.2, 0.3]; // O embedding falso do MockChatService

        const output = await askQuestion.execute(input);

        // Verifica se o repositório foi chamado com o vetor correto
        expect(spy).toHaveBeenCalledWith(expectedEmbedding);

        // Verifica se a resposta simulada (correta) foi retornada
        expect(output.answer).toContain("R$ 120,50");
        expect(output.answer).toContain("horário");
    });

    test("Deve falhar se o campo pergunta estiver vazio", async () => {
        const input: AskQuestionInput = {
            question: "",
            userId: "user-1"
        };
        await expect(askQuestion.execute(input)).rejects.toThrow("O campo pergunta é obrigatório.");
    });

    test("Deve salvar e recuperar histórico de mensagens", async () => {
        const input1: AskQuestionInput = {
            question: "Primeira pergunta (sobre coxim)",
            userId: "user-2"
        };

        const output1 = await askQuestion.execute(input1);
        const conversationId = output1.conversationId;

        const input2: AskQuestionInput = {
            question: "Segunda pergunta",
            userId: "user-2",
            conversationId
        };

        await askQuestion.execute(input2);

        const history = await chatHistoryService.getChatHistory(conversationId);

        expect(history.length).toBe(4);
        expect(history[0].role).toBe("user");
        expect(history[1].role).toBe("model");
        expect(history[2].role).toBe("user");
        expect(history[3].role).toBe("model");
    });
});