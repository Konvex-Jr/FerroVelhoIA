import Connection from "../../infra/database/Connection";
import GeminiChatService from "../../domain/Services/GeminiChatService";

export default class VectorizeProducts {
    private BATCH_SIZE = 10; // Processa de 10 em 10 para não estourar rate limit
    
    constructor(
        private connection: Connection,
        private geminiService: GeminiChatService
    ) {}

    async execute(): Promise<void> {
        console.log("[Vectorize] Iniciando ciclo de vetorização...");

        // Busca produtos pendentes
        const products = await this.fetchPendingProducts();
        
        if (products.length === 0) {
            console.log("[Vectorize] Nenhum produto pendente.");
            return;
        }

        console.log(`[Vectorize] Processando ${products.length} produtos...`);

        for (const product of products) {
            try {
                // Cria o texto que será vetorizado (O "Corpo" do conhecimento do produto)
                // Incluí ID, SKU e Preço no texto para ajudar na semântica, 
                // mas o principal é o NOME.
                const textToEmbed = `Produto: ${product.name}. Código: ${product.sku || ''}. Preço: R$ ${product.price}.`;

                // Gera o embedding
                const embedding = await this.geminiService.generateEmbedding(textToEmbed);

                // Salva no banco e remove a flag
                await this.updateProductEmbedding(product.id, embedding);
                
                // Pequeno delay para evitar rate limit do Gemini (opcional, mas seguro)
                await new Promise(resolve => setTimeout(resolve, 500)); 

            } catch (error) {
                console.error(`[Vectorize] Erro ao processar produto ${product.id}:`, error);
            }
        }
        
        console.log("[Vectorize] Ciclo finalizado.");
    }

    private async fetchPendingProducts() {
        const result: any = await this.connection.execute(`
            SELECT id, name, sku, price 
            FROM public.tiny_products 
            WHERE needs_vectorization = TRUE 
            AND status = 'A' -- Apenas ativos
            LIMIT $1
        `, [this.BATCH_SIZE]);
        
        return Array.isArray(result) ? result : result.rows || [];
    }

    private async updateProductEmbedding(id: number, embedding: number[]) {
        // O pgvector exige o formato de array string: '[0.1, 0.2, ...]'
        // Algumas libs aceitam array direto, outras precisam do JSON.stringify
        const vectorString = JSON.stringify(embedding);

        await this.connection.execute(`
            UPDATE public.tiny_products 
            SET 
                embedding = $1::vector, 
                needs_vectorization = FALSE,
                last_vectorized_at = NOW()
            WHERE id = $2
        `, [vectorString, id]);
    }
}