import ChunkRepositoryInterface from "./ChunkRepositoryInterface";
import TokenRepositoryInterface from "./TokenRepositoryInterface";
import ConversationRepositoryInterface from "./ConversationRepositoryInterface";
import Connection from "../../infra/database/Connection";

export default interface RepositoryFactoryInterface {

    createTokenRepository(): TokenRepositoryInterface;
    createChunkRepository(): ChunkRepositoryInterface;
    createConversationRepository(): ConversationRepositoryInterface;
    createConnection(): Connection;
}