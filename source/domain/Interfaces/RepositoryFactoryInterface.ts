import ChunkRepositoryInterface from "./ChunkRepositoryInterface";
import TokenRepositoryInterface from "./TokenRepositoryInterface";
import ConversationRepositoryInterface from "./ConversationRepositoryInterface";
import { TinyRepositoryInterface } from "./TinyRepositoryInterface";

export default interface RepositoryFactoryInterface {

    createTokenRepository(): TokenRepositoryInterface;
    createChunkRepository(): ChunkRepositoryInterface;
    createConversationRepository(): ConversationRepositoryInterface;
    createTinyRepository(): TinyRepositoryInterface;
}