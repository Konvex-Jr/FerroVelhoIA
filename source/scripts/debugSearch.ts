import { config } from "dotenv";
import PostgreSQLConnection from "../infra/database/PostgreSQLConnection";
import DatabaseRepositoryFactory from "../infra/repository/DatabaseRepositoryFactory";
import ProductRepository from "../infra/repository/ProductRepository";
import GeminiChatService from "../domain/Services/GeminiChatService";
import ChatHistoryService from "../domain/Services/ChatHistoryService";

config();

async function main() {
  const searchTerm = process.argv[2] || "compressor";
  console.log(`🔎 Buscando por: "${searchTerm}"...`);

  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    database: process.env.DB_DATABASE ?? "chatbot_db",
    host: process.env.DB_HOST ?? "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  });

  const repoFactory = new DatabaseRepositoryFactory(connection);
  const historyService = new ChatHistoryService(repoFactory);
  
  // Instancia o ChatService (que agora gera vetores de 768 dimensões)
  const chatService = new GeminiChatService(repoFactory, historyService);
  
  const productRepo = new ProductRepository(connection, chatService);

  try {
    const results = await productRepo.findProductsByVector(searchTerm);
    
    console.log("\n--- RESULTADOS DA BUSCA ---");
    if (results.length === 0) {
        console.log("❌ Nenhum produto encontrado (Vetor vazio ou distante).");
    }
    
    results.forEach((p: any) => {
        console.log(`\n📦 Produto: ${p.name}`);
        console.log(`   💰 Preço: R$ ${p.price}`);
        console.log(`   🔢 Estoque: ${p.quantity}`);
        console.log(`   🎯 Similaridade: ${p.similarity?.toFixed(4)}`); // Quanto mais próximo de 1.0, melhor
    });
    
  } catch (error) {
    console.error("Erro na busca:", error);
  } finally {
    await connection.close();
  }
}

main();