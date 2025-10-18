import Chunk from "../../../domain/Entity/Chunk";
import ChunkRepositoryInterface from "../../../domain/Interfaces/ChunkRepositoryInterface";
import Connection from "../../database/Connection";

export default class ChunkRepositoryDatabase implements ChunkRepositoryInterface {

    constructor(protected connection: Connection) {
    }

    async create(chunk: Chunk): Promise<Chunk | null> {
        await this.connection.execute("insert into public.chunks (fileName, chunk, embedding, created_at, updated_at) values ($1, $2, $3, $4, $5);", [chunk.fileName, chunk.chunk, chunk.embedding, chunk.createdAt, chunk.updatedAt]);
        return chunk;
    }

    async getAll(): Promise<Chunk[]> {
        return await this.connection.execute("select * from public.chunks order by created_at")
    }
}