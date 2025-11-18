import ChunkRepositoryInterface from "../../domain/Interfaces/ChunkRepositoryInterface";
import ConversationRepositoryInterface from "../../domain/Interfaces/ConversationRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import Connection from "../database/Connection";
import ChunkRepositoryMemory from "./memory/ChunkRepositoryMemory";
import ConversationRepositoryMemory from "./memory/ConversationRepositoryMemory";
import TokenRepositoryMemory from "./memory/TokenRepositoryMemory";

export default class MemoryRepositoryFactory implements RepositoryFactoryInterface {

    readonly tokenRepository: TokenRepositoryInterface;
    readonly chunkRepository: ChunkRepositoryInterface;
    readonly conversationRepository: ConversationRepositoryInterface;

    constructor() {
        this.tokenRepository = new TokenRepositoryMemory();
        this.chunkRepository = new ChunkRepositoryMemory();
        this.conversationRepository = new ConversationRepositoryMemory();
    }

    createTokenRepository(): TokenRepositoryInterface {
        return this.tokenRepository;
    }

    createChunkRepository(): ChunkRepositoryInterface {
        return this.chunkRepository;
    }

    createConversationRepository(): ConversationRepositoryInterface {
        return this.conversationRepository;
    }

    createConnection(): Connection {
        throw new Error("MemoryRepositoryFactory não suporta conexão com banco real (PostgreSQL). Use DatabaseRepositoryFactory.");
    }
}