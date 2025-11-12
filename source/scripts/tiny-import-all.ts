import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ImportAllProducts from "../useCases/tiny/ImportAllProducts";
import TinyClient from "../infra/clients/TinyClient";
import DatabaseRepositoryFactory from "../infra/repository/DatabaseRepositoryFactory";

config();

async function ensureSchema(conn: PostgreSQLConnection) {
  await conn.execute(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await conn.execute(`
      CREATE TABLE IF NOT EXISTS public.tiny_products (
        id BIGINT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        sku TEXT,
        gtin TEXT,
        unit TEXT,
        price NUMERIC(18,2),
        promo_price NUMERIC(18,2),
        cost_price NUMERIC(18,2),
        avg_cost_price NUMERIC(18,2),
        location TEXT,
        status CHAR(1),
        name_vector vector(768),
        created_at_tiny TIMESTAMP NULL,
        quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
        deposit_code TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`.trim());

  await conn.execute(`ALTER TABLE public.tiny_products ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,3) NOT NULL DEFAULT 0;`.trim());
  await conn.execute(`ALTER TABLE public.tiny_products ADD COLUMN IF NOT EXISTS deposit_code TEXT;`.trim());
  await conn.execute(`ALTER TABLE public.tiny_products ADD COLUMN IF NOT EXISTS name_vector vector(768);`.trim()); // Garante o vetor
  await conn.execute(`CREATE INDEX IF NOT EXISTS tiny_products_code_idx ON public.tiny_products(code);`.trim());
  await conn.execute(`CREATE INDEX IF NOT EXISTS tiny_products_updated_idx ON public.tiny_products(updated_at);`.trim());

  await conn.execute(`
      CREATE INDEX IF NOT EXISTS tiny_products_name_vector_idx
      ON public.tiny_products
      USING ivfflat (name_vector vector_l2_ops)
      WITH (lists = 100);
  `.trim());
}

async function ensureSyncStateTable(conn: PostgreSQLConnection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS public.tiny_sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `.trim());
}

async function main() {
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "",
    password: process.env.DB_PASSWORD ?? "",
    host: process.env.DB_HOST ?? "",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_DATABASE ?? "",
  });
  await ensureSchema(connection);
  await ensureSyncStateTable(connection);
  const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");

  const repositoryFactory = new DatabaseRepositoryFactory(connection);

  await new ImportAllProducts(repositoryFactory, tiny).run();

  await connection.close();
  console.log("Importação completa.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});