import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ImportAllProducts from "../useCases/tiny/ImportAllProducts";
import TinyClient from "../infra/clients/TinyClient";

config();

async function main() {
  console.log("🚀 Iniciando script de importação total...");

  const connection = new PostgreSQLConnection({
      user: process.env.DB_USERNAME ?? "",
      password: process.env.DB_PASSWORD ?? "",
      host: process.env.DB_HOST ?? "",
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database: process.env.DB_DATABASE ?? "",
    });

  // NÃO criamos tabelas aqui. Confiamos que as migrations já rodaram.
  
  const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
  
  try {
      await new ImportAllProducts(connection, tiny).run();
      console.log("✅ Importação completa.");
  } catch (error) {
      console.error("❌ Erro na importação:", error);
  } finally {
      await connection.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});