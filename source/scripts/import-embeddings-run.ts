import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import ConfigDatabase from "../infra/database/ConfigDatabase";
import DatabaseRepositoryFactory from "../infra/repository/DatabaseRepositoryFactory";
import ImportEmbeddings from "./import-embeddings";

const configDatabase: ConfigDatabase = {
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "pgsql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
};

async function main() {
    try {
        const inputFolder = process.argv[2] || "./docs";
        console.log("📂 Diretório de entrada:", inputFolder);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY não está definida nas variáveis de ambiente (.env)");
        }

        const gemini = new GoogleGenerativeAI(apiKey);

        const connection = new PostgreSQLConnection(configDatabase);
        const repositoryFactory = new DatabaseRepositoryFactory(connection);
        const importer = new ImportEmbeddings(repositoryFactory, gemini);

        await importer.run(inputFolder);

        console.log("✅ Importação finalizada!");
        await connection.close();
    } catch (err) {
        console.error("❌ Erro no script de importação:", err);
        process.exit(1);
    }
}

main();
