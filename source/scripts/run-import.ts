import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import TinyClientService from "../infra/clients/TinyClient";
import ImportAllProducts from "../useCases/tiny/ImportAllProducts";

config(); // Carrega as variáveis do .env

async function run() {
    console.log("🚀 Iniciando importação total do Tiny...");

    // 1. Configura Conexão
    const connection = new PostgreSQLConnection({
        user: process.env.DB_USERNAME ?? "postgres",
        password: process.env.DB_PASSWORD ?? "postgres",
        database: process.env.DB_DATABASE ?? "chatbot_db",
        host: process.env.DB_HOST ?? "localhost",
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
    });

    // 2. Configura Cliente Tiny
    const tinyClient = new TinyClientService(process.env.TINY_API_TOKEN || '');

    // 3. Instancia o Caso de Uso
    const importer = new ImportAllProducts(connection, tinyClient);

    // 4. Executa
    try {
        await importer.run();
        console.log("✅ Importação finalizada com sucesso!");
    } catch (error) {
        console.error("❌ Erro durante a importação:", error);
    } finally {
        await connection.close();
    }
}

run();