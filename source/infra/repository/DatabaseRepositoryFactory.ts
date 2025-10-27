import ChunkRepositoryInterface from "../../domain/Interfaces/ChunkRepositoryInterface";
import ConversationRepositoryInterface from "../../domain/Interfaces/ConversationRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import UserRepositoryInterface from "../../domain/Interfaces/UserRepositoryInterface";
import Connection from "../database/Connection";
import ChunkRepositoryDatabase from "./database/ChunkRepositoryDatabase";
import ConversationRepositoryDatabase from "./database/ConversationRepositoryDatabase";
import TokenRepositoryDatabase from "./database/TokenRepositoryDatabase";
import UserRepositoryDatabase from "./database/UserRepositoryDatabase";

export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {

    readonly userRepository: UserRepositoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    readonly chunkRepository: ChunkRepositoryInterface;
    readonly conversationRepository: ConversationRepositoryInterface;

    constructor(connection: Connection) {
        this.userRepository = new UserRepositoryDatabase(connection);
        this.tokenRepository = new TokenRepositoryDatabase(connection);
        this.chunkRepository = new ChunkRepositoryDatabase(connection);
        this.conversationRepository = new ConversationRepositoryDatabase(connection);
    }

    createUserRepository(): UserRepositoryInterface { return this.userRepository; }
    createTokenRepository(): TokenRepositoryInterface { return this.tokenRepository; }
    createChunkRepository(): ChunkRepositoryInterface { return this.chunkRepository; }
    createConversationRepository(): ConversationRepositoryInterface { return this.conversationRepository; }
}