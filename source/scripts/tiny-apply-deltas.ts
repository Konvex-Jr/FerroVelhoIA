import { config } from "dotenv";
config();

import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ApplyTinyDeltaUpdates from "../useCases/tiny/ApplyTinyDeltaUpdates";
import TinyClient from "../infra/clients/TinyClient";

async function main() {
  console.log("🔄 Iniciando script de Deltas (Atualização)...");

  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "",
    password: process.env.DB_PASSWORD ?? "",
    host: process.env.DB_HOST ?? "",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_DATABASE ?? "",
  });

  const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
  
  try {
      await new ApplyTinyDeltaUpdates(connection, tiny).run();
      console.log("✅ Deltas aplicados.");
  } catch (error) {
      console.error("❌ Erro nos deltas:", error);
  } finally {
      await connection.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});