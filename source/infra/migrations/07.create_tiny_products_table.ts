import Connection from "../database/Connection";

export default class CreateTinyProductsTable {
  constructor(private connection: Connection) { }

  async up(): Promise<void> {
    // 1. Garante que a extensão de vetores está ativa no Postgres
    await this.connection.execute(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. Cria a tabela se ela não existir (Cenário de instalação limpa)
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS public.tiny_products (
        id BIGINT PRIMARY KEY,              -- id do Tiny
        code TEXT,                          -- codigo
        name TEXT NOT NULL,                 -- nome
        sku TEXT,                           -- codigo/sku
        gtin TEXT,
        unit TEXT,
        price NUMERIC(18,2),
        promo_price NUMERIC(18,2),
        cost_price NUMERIC(18,2),
        avg_cost_price NUMERIC(18,2),
        location TEXT,
        status CHAR(1) DEFAULT 'A',         -- A/I/E
        created_at_tiny TIMESTAMP NULL,

        -- estoque direto no produto
        quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
        deposit_code TEXT,

        -- Vetorização (Incluído no CREATE para instalações novas)
        embedding vector(768),                      -- Embedding do Gemini
        needs_vectorization BOOLEAN DEFAULT TRUE,   -- Flag para processar
        last_vectorized_at TIMESTAMP,               -- Última vetorização
        
        -- Metadados
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. AJUSTE CRÍTICO: Garante as colunas caso a tabela já exista (Cenário de atualização)
    // Isso resolve o erro "column embedding does not exist"
    await this.connection.execute(`
       ALTER TABLE public.tiny_products
       ADD COLUMN IF NOT EXISTS embedding vector(768),
       ADD COLUMN IF NOT EXISTS needs_vectorization BOOLEAN DEFAULT TRUE,
       ADD COLUMN IF NOT EXISTS last_vectorized_at TIMESTAMP,
       ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS deposit_code TEXT;
    `);

    // 4. Criação de Índices
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_code_idx ON public.tiny_products(code);
    `);

    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_name_idx 
        ON public.tiny_products USING gin(to_tsvector('portuguese', name));
    `);

    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_status_idx 
        ON public.tiny_products(status) 
        WHERE status = 'A';
    `);

    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_gtin_idx 
        ON public.tiny_products(gtin) 
        WHERE gtin IS NOT NULL;
    `);

    // Índice vetorial (HNSW - Melhor performance para RAG)
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_embedding_idx 
        ON public.tiny_products 
        USING hnsw (embedding vector_cosine_ops);
    `);

    // Índice para a fila de vetorização
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_needs_vec_idx 
        ON public.tiny_products(needs_vectorization) 
        WHERE needs_vectorization = TRUE;
    `);
  }

  async down(): Promise<void> {
    await this.connection.execute("DROP TABLE IF EXISTS public.tiny_products CASCADE;");
  }
}