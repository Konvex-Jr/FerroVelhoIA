import Connection from "../database/Connection";

export default class CreateTinyProductStockTable {
  constructor(private connection: Connection) {}

  async up(): Promise<void> {
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS public.tiny_product_stock (
        product_id BIGINT NOT NULL REFERENCES public.tiny_products(id) ON DELETE CASCADE,
        deposit_code TEXT NOT NULL,                  -- identificador do depósito no Tiny
        deposit_name TEXT,
        quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (product_id, deposit_code)
      );
    `);
    await this.connection.execute(`
      CREATE INDEX IF NOT EXISTS tiny_product_stock_deposit_idx ON public.tiny_product_stock(deposit_code);
    `);
  }

  async down(): Promise<void> {
    await this.connection.execute("DROP TABLE IF EXISTS public.tiny_product_stock;");
  }
}
