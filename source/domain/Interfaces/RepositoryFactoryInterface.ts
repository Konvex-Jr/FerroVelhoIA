import ChunkRepositoryInterface from "./ChunkRepositoryInterface";
import TokenRepositoryInterface from "./TokenRepositoryInterface";
import UserRepositoryInterface from "./UserRepositoryInterface";
import ConversationRepositoryInterface from "./ConversationRepositoryInterface";

export default interface RepositoryFactoryInterface {

    createUserRepository(): UserRepositoryInterface;
    createTokenRepository(): TokenRepositoryInterface;
    createChunkRepository(): ChunkRepositoryInterface;
    createConversationRepository(): ConversationRepositoryInterface;
}