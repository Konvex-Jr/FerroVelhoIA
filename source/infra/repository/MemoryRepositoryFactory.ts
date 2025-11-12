import ChunkRepositoryInterface from "../../domain/Interfaces/ChunkRepositoryInterface";
import ConversationRepositoryInterface from "../../domain/Interfaces/ConversationRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import ChunkRepositoryMemory from "./memory/ChunkRepositoryMemory";
import ConversationRepositoryMemory from "./memory/ConversationRepositoryMemory";
import TokenRepositoryMemory from "./memory/TokenRepositoryMemory";

import { LocalTinyProduct, TinyRepositoryInterface } from "../../domain/Interfaces/TinyRepositoryInterface";

class TinyRepositoryMemory implements TinyRepositoryInterface {

    async findProductsByName(queryVector: number[]): Promise<LocalTinyProduct[]> {
        return [];
    }

    async saveProductWithVector(product: LocalTinyProduct): Promise<void> {
    }
    async updateStock(productId: string | number, quantity: number, depositCode: string): Promise<void> {
    }
    async getLastSync(key: string): Promise<string | null> {
        return null;
    }
    async setLastSync(key: string, value: string): Promise<void> {
    }
    async getStateNumber(key: string, fallback: number): Promise<number> {
        return fallback;
    }
    async setState(key: string, value: string): Promise<void> {
    }
}

export default class MemoryRepositoryFactory implements RepositoryFactoryInterface {

    readonly tokenRepository: TokenRepositoryInterface;
    readonly chunkRepository: ChunkRepositoryInterface;
    readonly conversationRepository: ConversationRepositoryInterface;
    readonly tinyRepository: TinyRepositoryInterface;

    constructor() {
        this.tokenRepository = new TokenRepositoryMemory();
        this.chunkRepository = new ChunkRepositoryMemory();
        this.conversationRepository = new ConversationRepositoryMemory();
        this.tinyRepository = new TinyRepositoryMemory();
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

    createTinyRepository(): TinyRepositoryInterface {
        return this.tinyRepository;
    }
}