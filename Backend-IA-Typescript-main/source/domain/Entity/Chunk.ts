export default class Chunk {
    readonly fileName: string;
    readonly chunk: string;
    readonly embedding: number[];
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(
        fileName: string,
        chunk: string,
        embedding: number[],
    ) {
        this.fileName = fileName;
        this.chunk = chunk;
        this.embedding = embedding;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
}
