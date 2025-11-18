import Connection from "../database/Connection";
import GeminiChatService from "../../domain/Services/GeminiChatService";

// Interface para tipar o retorno dos produtos
export interface ProductData {
  id: number;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  similarity?: number;
}

export default class ProductRepository {
    
    constructor(
        private connection: Connection, 
        private chatService: GeminiChatService 
    ) {}

    async findProductsByVector(userQuery: string): Promise<ProductData[]> {
        // 1. Gera o embedding da pergunta do usuário (Ex: "tem calça jeans?")
        // A IA transforma a intenção do usuário em números.
        const queryEmbedding = await this.chatService.generateEmbedding(userQuery);
        
        // O pgvector exige o vetor em formato string JSON: '[0.01, -0.02, ...]'
        const vectorString = JSON.stringify(queryEmbedding);

        // 2. Busca Híbrida no Banco
        // - "embedding <=> $1": Calcula a distância (quanto menor, mais similar).
        // - Buscamos 'quantity' direto da tabela, garantindo que o estoque seja o REAL do momento.
        const sql = `
            SELECT 
                id, 
                name, 
                sku, 
                price, 
                quantity,
                1 - (embedding <=> $1::vector) as similarity
            FROM public.tiny_products 
            WHERE status = 'A' 
            ORDER BY embedding <=> $1::vector ASC
            LIMIT 5;
        `;

        const result: any = await this.connection.execute(sql, [vectorString]);
        
        // Tratamento para diferentes drivers de conexão (pg puro retorna .rows, outros retornam array direto)
        const rows = Array.isArray(result) ? result : result.rows || [];
        
        return rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            price: Number(row.price),
            quantity: Number(row.quantity), // Aqui vem o estoque atualizado
            similarity: Number(row.similarity)
        }));
    }
}