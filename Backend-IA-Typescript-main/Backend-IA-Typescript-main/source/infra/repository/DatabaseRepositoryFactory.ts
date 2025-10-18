import ChunkRepositoryInterface from "../../domain/Interfaces/ChunkRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../../domain/Interfaces/TokenRepositoryInterface";
import UserRepositoryInterface from "../../domain/Interfaces/UserRepositoryInterface";
import Connection from "../database/Connection";
import ChunkRepositoryDatabase from "./database/ChunkRepositoryMemory";
import TokenRepositoryDatabase from "./database/TokenRepositoryDatabase";
import UserRepositoryDatabase from "./database/UserRepositoryDatabase";

export default class DatabaseRepositoryFactory implements RepositoryFactoryInterface {

    readonly userRepository: UserRepositoryInterface;
    readonly tokenRepository: TokenRepositoryInterface;
    readonly chunkRepository: ChunkRepositoryInterface;

    constructor(connection: Connection) {
        this.userRepository = new UserRepositoryDatabase(connection);
        this.tokenRepository = new TokenRepositoryDatabase(connection);
        this.chunkRepository = new ChunkRepositoryDatabase(connection);
    }

    createUserRepository(): UserRepositoryInterface {
        return this.userRepository;
    }

    createTokenRepository(): TokenRepositoryInterface {
        return this.tokenRepository;
    }

    createChunkRepository(): ChunkRepositoryInterface {
        return this.chunkRepository;
    }
}