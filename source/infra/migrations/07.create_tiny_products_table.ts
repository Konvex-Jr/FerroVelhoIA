import Connection from "../database/Connection";

export default class CreateTinyProductsTable {
  constructor(private connection: Connection) { }

  async up(): Promise<void> {
    await this.connection.execute(`CREATE EXTENSION IF NOT EXISTS vector;`);

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
        status CHAR(1),                     -- A/I/E
        name_vector vector(768),
        created_at_tiny TIMESTAMP NULL,

        -- estoque direto no produto
        quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
        deposit_code TEXT,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_code_idx ON public.tiny_products(code);
    `);
    
    await this.connection.execute(`
            CREATE INDEX IF NOT EXISTS tiny_products_name_vector_idx
            ON public.tiny_products
            USING ivfflat (name_vector vector_l2_ops)
            WITH (lists = 100);
        `);
  }

  async down(): Promise<void> {
    await this.connection.execute("DROP TABLE IF EXISTS public.tiny_products;");
  }
}
