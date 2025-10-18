import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import ChunkRepositoryInterface from "../Interfaces/ChunkRepositoryInterface";
import Chunk from "../Entity/Chunk";

export default class ChunkService {
    private chunkRepository: ChunkRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.chunkRepository = repositoryFactory.createChunkRepository();
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val ** 2, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val ** 2, 0));
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async findRelevantChunks(questionEmbedding: number[], topK = 3): Promise<Chunk[]> {
        const allChunks: Chunk[] = await this.chunkRepository.getAll();
        if (!allChunks.length) return [];

        const sims = allChunks.map(chunk => ({
            chunk,
            sim: this.cosineSimilarity(questionEmbedding, chunk.embedding),
        }));

        sims.sort((a, b) => b.sim - a.sim);

        return sims.slice(0, topK).map(s => s.chunk);
    }
}
