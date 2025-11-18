import { ModelType } from "../source/domain/Enums/ModelType";
import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import AskQuestion from "../source/useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../source/useCases/askQuestion/AskQuestionInput";
import 'dotenv/config';
import ChatHistoryService from '../source/domain/Services/ChatHistoryService';
import Conversation from "../source/domain/Entity/Conversation";
import Connection from "../source/infra/database/Connection";

// 1. Mock da Conexão com o Banco (Para simular a busca vetorial e de produtos)
class MockConnection implements Connection {
    async execute(statement: string, params?: any[]): Promise<any[]> {
        // Se for a query de busca de produtos (identificada por conter 'tiny_products')
        if (statement.includes("tiny_products")) {
            return [
                { 
                    id: 1, 
                    name: "Produto Teste 1", 
                    sku: "TST001", 
                    price: 100.00, 
                    quantity: 10, 
                    similarity: 0.95 
                },
                { 
                    id: 2, 
                    name: "Produto Teste 2 (Sem Estoque)", 
                    sku: "TST002", 
                    price: 50.00, 
                    quantity: 0, 
                    similarity: 0.85 
                }
            ];
        }
        return [];
    }

    async close(): Promise<void> {
        return;
    }
}

// 2. Mock da Factory para entregar a Conexão Mockada
class MockRepositoryFactory extends MemoryRepositoryFactory implements RepositoryFactoryInterface {
    createConnection(): Connection {
        return new MockConnection();
    }
}

class MockChunkService {
    async findRelevantChunks(embedding: number[]) {
        return [{ chunk: "Informação Institucional: Somos o Ferro Velho do Compressor." }];
    }
}

class MockChatService {
    private chatHistoryService: ChatHistoryService;
    constructor(chatHistoryService: ChatHistoryService) {
        this.chatHistoryService = chatHistoryService;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return [0.1, 0.2, 0.3];
    }

    async chatWithConversation(conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string) {
        // Salva o user prompt para verificarmos se os produtos foram injetados no contexto
        await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
        
        // Simula uma resposta
        const simulatedAnswer = "Resposta simulada pelo Gemini";
        
        await this.chatHistoryService.addMessage(conversation.id, "model", simulatedAnswer);
        return simulatedAnswer;
    }
}

class MockTinyClientService {
    // Métodos vazios ou mocks simples, já que agora usamos o Banco e não o Client direto no chat
    async searchProducts() { return {}; }
    async getProductStock() { return {}; }
}

describe("AskQuestion use case", () => {
    let askQuestion: AskQuestion;
    let repositoryFactory: RepositoryFactoryInterface;
    let chatHistoryService: ChatHistoryService;

    beforeEach(() => {
        // Usamos a Factory Mockada que suporta createConnection
        repositoryFactory = new MockRepositoryFactory();
        chatHistoryService = new ChatHistoryService(repositoryFactory);
        
        const mockChatService = new MockChatService(chatHistoryService);
        const mockChunkService = new MockChunkService();
        const mockTinyClient = new MockTinyClientService();

        askQuestion = new AskQuestion(
            repositoryFactory,
            mockChunkService as any,
            mockChatService as any,
            chatHistoryService,
            mockTinyClient as any 
        );
    });

    test("Deve gerar resposta para pergunta válida", async () => {
        const input: AskQuestionInput = {
            question: "Tem compressor?",
            userId: "5511999999999",
        };
        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada pelo Gemini");
        expect(output.conversationId).toBeDefined();
    });

    test("Deve injetar produtos do banco no contexto da pergunta", async () => {
        const input: AskQuestionInput = {
            question: "Quanto custa o produto teste?",
            userId: "5511999988888",
        };

        const output = await askQuestion.execute(input);
        
        // Recupera o histórico para ver o que foi enviado ao "Modelo"
        const history = await chatHistoryService.getChatHistory(output.conversationId);
        const lastUserMessage = history.find(m => m.role === "user")?.content;

        // Verifica se o texto do produto mockado apareceu no prompt
        expect(lastUserMessage).toContain("Produto Teste 1");
        expect(lastUserMessage).toContain("R$ 100.00");
        expect(lastUserMessage).toContain("Estoque ATUAL: 10");
        expect(lastUserMessage).toContain("FERRAMENTA DE ESTOQUE");
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
            question: "Primeira pergunta",
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

        // User1 -> Model1 -> User2 -> Model2
        expect(history.length).toBe(4);
        expect(history[0].role).toBe("user");
        expect(history[1].role).toBe("model");
    });
});