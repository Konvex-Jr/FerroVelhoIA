import ChunkRepositoryInterface from "../../domain/Interfaces/ChunkRepositoryInterface";
import ConversationRepositoryInterface from "../../domain/Interfaces/ConversationRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import Connection from "../database/Connection";
import ChunkRepositoryDatabase from "./database/ChunkRepositoryDatabase";
import ConversationRepositoryDatabase from "./database/ConversationRepositoryDatabase";
import TokenRepositoryDatabase from "./database/TokenRepositoryDatabase";

export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {

    readonly tokenRepository: TokenRepositoryInterface;
    readonly chunkRepository: ChunkRepositoryInterface;
    readonly conversationRepository: ConversationRepositoryInterface;

    constructor(connection: Connection) {
        this.tokenRepository = new TokenRepositoryDatabase(connection);
        this.chunkRepository = new ChunkRepositoryDatabase(connection);
        this.conversationRepository = new ConversationRepositoryDatabase(connection);
    }

    createTokenRepository(): TokenRepositoryInterface { return this.tokenRepository; }
    createChunkRepository(): ChunkRepositoryInterface { return this.chunkRepository; }
    createConversationRepository(): ConversationRepositoryInterface { return this.conversationRepository; }
   
}