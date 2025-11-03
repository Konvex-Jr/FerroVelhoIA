import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import TinyClient from "../infra/clients/TinyClient";
import ApplyTinyPaginationSync from "../useCases/tiny/ApplyTinyPaginationSync";

config();

async function main() {
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "",
    password: process.env.DB_PASSWORD ?? "",
    host: process.env.DB_HOST ?? "",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_DATABASE ?? ""
  });

  const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
  const job = new ApplyTinyPaginationSync(connection, tiny);

  await job.run();
  await connection.close();
}

main().catch((err) => {
  console.error("[fallback] erro geral:", err?.message ?? err);
  process.exit(1);
});
