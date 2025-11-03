import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ImportAllProducts from "../useCases/tiny/ImportAllProducts";
import TinyClient from "../infra/clients/TinyClient";

config();

async function main() {
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME!,
  });
  const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
  await new ImportAllProducts(connection, tiny).run();
  await connection.close();
  console.log("Importação completa.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
