import ChunkRepositoryInterface from "./ChunkRepositoryInterface";
import TokenRepositoryInterface from "./TokenRepositoryInterface";
import UserRepositoryInterface from "./UserRepositoryInterface";

export default interface RepositoryFactoryInterface {

    createUserRepository(): UserRepositoryInterface;
    createTokenRepository(): TokenRepositoryInterface;
    createChunkRepository(): ChunkRepositoryInterface;
}