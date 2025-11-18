import { config } from "dotenv";

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
import ChatHistoryService from "./domain/Services/ChatHistoryService"; // Importe o History

import RagController from "./infra/controller/RagController";
import AskQuestion from "./useCases/askQuestion/AskQuestion";
import EvolutionRoutes from "./infra/http/Routes/EvolutionRoutes";
import TinyClientService from "./infra/clients/TinyClient";

config();

async function bootstrap() {
  // 1. CONEXÃO REAL COM O BANCO
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    database: process.env.DB_DATABASE ?? "chatbot_db",
    host: process.env.DB_HOST ?? "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  });

  // 2. RODAR MIGRATIONS
  try {
    // console.log("Rodando migrations...");
    await new CreateTokensTable(connection).up();
    await new CreateChunksTable(connection).up();
    await new CreateConversationsTable(connection).up();
    await new CreateMessagesTable(connection).up();
    await new CreateTinyProductsTable(connection).up();
    await new CreateTinySyncStateTable(connection).up();
    // console.log("Migrations finalizadas.");
  } catch (err) {
    console.error("Erro ao rodar as migrations:", err);
  }

  // 3. FACTORY E HTTP
  const repositoryFactory = new DatabaseRepositoryFactory(connection);
  const http = new ExpressHttp();
  const router = new Router(http, repositoryFactory);

  router.init();

  // 4. INICIALIZAÇÃO DOS SERVIÇOS
  const tinyClient = new TinyClientService(process.env.TINY_API_TOKEN || '');
  
  // Instancia o Histórico
  const chatHistoryService = new ChatHistoryService(repositoryFactory);

  // --- CORREÇÃO AQUI ---
  // Removemos o tinyClient deste construtor. 
  // O GeminiChatService agora é puro (só texto), pois o AskQuestion já injeta os produtos no prompt.
  const chatService = new GeminiChatService(
      repositoryFactory, 
      chatHistoryService
      // tinyClient removido daqui!
  );
  
  // Injetamos tudo no AskQuestion
  const askQuestionUseCase = new AskQuestion(
      repositoryFactory, 
      undefined, // ChunkService (padrão)
      chatService, // O serviço corrigido
      chatHistoryService,
      tinyClient // O AskQuestion ainda recebe o TinyClient (usado internamente ou para fallback)
  );
  
  const ragController = new RagController(askQuestionUseCase);

  // Rotas do WhatsApp
  new EvolutionRoutes(http, ragController).init();

  // 5. JOB DE VETORIZAÇÃO
  // Usamos o mesmo chatService (que já está configurado sem o tinyClient, perfeito para gerar embeddings)
  const vectorizeJob = new VectorizeProducts(connection, chatService);

  setInterval(async () => {
      try {
          await vectorizeJob.execute();
      } catch (e) {
          console.error("[Main] Erro no job de vetorização:", e);
      }
  }, 60 * 1000);

  const port = Number(process.env.PORT ?? 5001);
  http.listen(port);
  console.log(`Running on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
}

bootstrap();