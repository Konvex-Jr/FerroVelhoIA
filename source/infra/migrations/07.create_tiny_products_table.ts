import Connection from "../database/Connection";

export default class CreateTinyProductsTable {
  constructor(private connection: Connection) {}

  async up(): Promise<void> {
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
        created_at_tiny TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_code_idx ON public.tiny_products(code);
    `);
  }

  async down(): Promise<void> {
    await this.connection.execute("DROP TABLE IF EXISTS public.tiny_products;");
  }
}
