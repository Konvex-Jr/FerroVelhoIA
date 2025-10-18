import { ModelType } from "../source/domain/Enums/ModelType";
import { TokenType } from "../source/domain/Enums/TokenType";
import RepositoryFactoryInterface from "../source/domain/Interfaces/RepositoryFactoryInterface";
import MemoryRepositoryFactory from "../source/infra/repository/MemoryRepositoryFactory";
import AskQuestion from "../source/useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../source/useCases/askQuestion/AskQuestionInput";
import 'dotenv/config';

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
    async chatWithContext(model: ModelType, systemPrompt: string, userPrompt: string) {
        return "Resposta simulada";
    }
}

describe("AskQuestion use case", () => {
    let askQuestion: AskQuestion;
    let repositoryFactory: RepositoryFactoryInterface;

    beforeEach(() => {
        repositoryFactory = new MemoryRepositoryFactory();
        askQuestion = new AskQuestion(
            repositoryFactory,
            new MockEmbeddingService() as any,
            new MockChunkService() as any,
            new MockChatService() as any
        );
    });

    test("Deve gerar resposta para pergunta válida", async () => {
        const input: AskQuestionInput = { 
            question: "Qual o impacto do ODS 4?",
            mentorType: "GENERATIVO"
        };
        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada");
    });

    test("Deve falhar se o campo pergunta estiver vazio", async () => {
        const input: AskQuestionInput = { 
            question: "",
            mentorType: "GENERATIVO"
        };
        await expect(askQuestion.execute(input)).rejects.toThrow("O campo pergunta é obrigatório.");
    });

    test("Deve falhar se PDF inválido for enviado", async () => {
        const input: AskQuestionInput = {
            question: "Pergunta qualquer",
            mentorType: "REFLEXIVO",
            file: { type: "text/plain", size: 500, buffer: Buffer.from("teste") } as any
        };
        await expect(askQuestion.execute(input)).rejects.toThrow("Formato inválido. Apenas PDF é aceito.");
    });

    test("Deve aceitar PDF válido", async () => {
        const input: AskQuestionInput = {
            question: "Pergunta com PDF",
            mentorType: "REFLEXIVO",
            file: {
                mimetype: "application/pdf",
                size: 500,
                originalname: "teste.pdf",
                buffer: Buffer.from(
                    "%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF", "utf-8"
                )
            } as Express.Multer.File
        };

        const output = await askQuestion.execute(input);
        expect(output.answer).toBe("Resposta simulada");
    });
})
