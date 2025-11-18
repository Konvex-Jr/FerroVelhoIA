import { config } from "dotenv";
import path from "path";

// Garante carregamento do .env da raiz
config({ path: path.resolve(process.cwd(), ".env") });

import PostgreSQLConnection from "./infra/database/PostgreSQLConnection";
import ExpressHttp from "./infra/http/ExpressHttp";
import Router from "./infra/http/Router";
import DatabaseRepositoryFactory from "./infra/repository/DatabaseRepositoryFactory";

// Migrations
import CreateTokensTable from "./infra/migrations/02.create_tokens_table";
import CreateChunksTable from "./infra/migrations/03.create_chunks_table";
import CreateConversationsTable from "./infra/migrations/04.create_conversations_table";
import CreateMessagesTable from "./infra/migrations/05.create_messages_table";

// Tiny Migrations & UseCases
import CreateTinyProductsTable from "./infra/migrations/07.create_tiny_products_table";
import CreateTinySyncStateTable from "./infra/migrations/09.create_tiny_sync_state_table";
import VectorizeProducts from "./useCases/tiny/VectorizeProducts";
import GeminiChatService from "./domain/Services/GeminiChatService";
import ChatHistoryService from "./domain/Services/ChatHistoryService";

import RagController from "./infra/controller/RagController";
import AskQuestion from "./useCases/askQuestion/AskQuestion";
import EvolutionRoutes from "./infra/http/Routes/EvolutionRoutes";
import TinyClientService from "./infra/clients/TinyClient";

async function bootstrap() {
  console.log("🚀 Iniciando aplicação...");

  // 1. CONEXÃO REAL COM O BANCO
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    database: process.env.DB_DATABASE ?? "chatbot_db",
    host: process.env.DB_HOST ?? "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  });

  // 2. RODAR MIGRATIONS (Garante estrutura do banco)
  try {
    await new CreateTokensTable(connection).up();
    await new CreateChunksTable(connection).up();
    await new CreateConversationsTable(connection).up();
    await new CreateMessagesTable(connection).up();
    await new CreateTinyProductsTable(connection).up();
    await new CreateTinySyncStateTable(connection).up();
    console.log("✅ Migrations verificadas.");
  } catch (err) {
    console.error("❌ Erro ao rodar as migrations:", err);
    // Não matamos o processo aqui, pois pode ser erro de "tabela já existe" que a migration já trata
  }

  // 3. FACTORY E HTTP
  const repositoryFactory = new DatabaseRepositoryFactory(connection);
  const http = new ExpressHttp();
  const router = new Router(http, repositoryFactory);

  router.init();

  // 4. INICIALIZAÇÃO DOS SERVIÇOS
  const tinyClient = new TinyClientService(process.env.TINY_API_TOKEN || '');
  const chatHistoryService = new ChatHistoryService(repositoryFactory);

  // GeminiChatService "Puro" (Sem TinyClient, focado em texto/vetores)
  const chatService = new GeminiChatService(
    repositoryFactory,
    chatHistoryService
  );

  // AskQuestion com todas as dependências injetadas (RAG completo)
  const askQuestionUseCase = new AskQuestion(
    repositoryFactory,
    undefined, // ChunkService padrão
    chatService,
    chatHistoryService,
    tinyClient
  );

  const ragController = new RagController(askQuestionUseCase);

  // Rotas do WhatsApp (Evolution API)
  new EvolutionRoutes(http, ragController).init();

  // 5. JOB DE VETORIZAÇÃO (Background)
  const vectorizeJob = new VectorizeProducts(connection, chatService);

  setInterval(async () => {
    try {
      await vectorizeJob.execute();
    } catch (e) {
      console.error("[Main] Erro no job de vetorização:", e);
    }
  }, 60 * 1000); // Roda a cada 60s

  const port = Number(process.env.PORT ?? 5001); // Porta padrão 5001 (ajustado para bater com seu log anterior)
  await http.listen(port);
  console.log(`Server running on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap application", err);
  process.exit(1);
});