import { ModelType } from "../source/domain/Enums/ModelType";
import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import AskQuestion from "../source/useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../source/useCases/askQuestion/AskQuestionInput";
import 'dotenv/config';
import ChatHistoryService from '../source/domain/Services/ChatHistoryService';
import Conversation from "../source/domain/Entity/Conversation";


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

    async generateEmbedding(text: string): Promise<number[]> {
        return [0.1, 0.2, 0.3];
    }

    async chatWithConversation(conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string) {
        await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
        const simulatedAnswer = "Resposta simulada";
        
        await this.chatHistoryService.addMessage(conversation.id, "model", simulatedAnswer);
        return simulatedAnswer;
    }
}

class MockTinyClientService {
}

describe("AskQuestion use case", () => {
    let askQuestion: AskQuestion;
    let repositoryFactory: RepositoryFactoryInterface;
    let chatHistoryService: ChatHistoryService;

    beforeEach(() => {
        repositoryFactory = new MemoryRepositoryFactory();
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
            question: "Qual o impacto do ODS 4?",
            userId: "user-1",
        };
        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada");
        expect(output.conversationId).toBeDefined();
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

        expect(history.length).toBe(4);
        expect(history[0].role).toBe("user");
        expect(history[1].role).toBe("model");
        expect(history[2].role).toBe("user");
        expect(history[3].role).toBe("model");
    });
});