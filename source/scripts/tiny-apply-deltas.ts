import { config } from "dotenv";
config();

import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ApplyTinyDeltaUpdates from "../useCases/tiny/ApplyTinyDeltaUpdates";
import TinyClient from "../infra/clients/TinyClient";

async function ensureSchema(conn: PostgreSQLConnection) {
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
      created_at_tiny TIMESTAMP NULL,
      -- colunas novas para modelo de tabela única:
      quantity NUMERIC(18,3) NOT NULL DEFAULT 0,
      deposit_code TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // se a tabela já existia antiga, garante as novas colunas:
  await conn.execute(`ALTER TABLE public.tiny_products ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,3) NOT NULL DEFAULT 0;`);
  await conn.execute(`ALTER TABLE public.tiny_products ADD COLUMN IF NOT EXISTS deposit_code TEXT;`);

  await conn.execute(`CREATE INDEX IF NOT EXISTS tiny_products_code_idx ON public.tiny_products(code);`);
  await conn.execute(`CREATE INDEX IF NOT EXISTS tiny_products_updated_idx ON public.tiny_products(updated_at);`);
}

async function ensureSyncStateTable(conn: PostgreSQLConnection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS public.tiny_sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
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
  await new ApplyTinyDeltaUpdates(connection, tiny).run();
  await connection.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
