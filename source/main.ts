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
// import CreateFeedbacksTable from "./infra/migrations/06.create_feedbacks_table";

// Tiny
import CreateTinyProductsTable from "./infra/migrations/07.create_tiny_products_table";
import CreateTinyProductStockTable from "./infra/migrations/08.create_tiny_product_stock_table";
import CreateTinySyncStateTable from "./infra/migrations/09.create_tiny_sync_state_table";
import TinyRoutes from "./infra/http/Routes/TinyRoutes"; 
config();

async function bootstrap() {
  const connection = new PostgreSQLConnection({
    user: process.env.DB_USERNAME ?? "",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_DATABASE ?? "",
    host: process.env.DB_HOST ?? "",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
  });

  try {
    await new CreateTokensTable(connection).up();
    await new CreateChunksTable(connection).up();
    await new CreateConversationsTable(connection).up();
    await new CreateMessagesTable(connection).up();
    // await new CreateFeedbacksTable(connection).up();

    await new CreateTinyProductsTable(connection).up();
    await new CreateTinyProductStockTable(connection).up();
    await new CreateTinySyncStateTable(connection).up();
  } catch (err) {
    console.error("Erro ao rodar as migrations:", err);
  }

  const repositoryFactory = new DatabaseRepositoryFactory(connection);
  const http = new ExpressHttp();
  const router = new Router(http, repositoryFactory);

  router.init();

  new TinyRoutes(http, connection).init();

  const port = Number(process.env.PORT ?? 5001);
  http.listen(port);
  console.log(`Running on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
}

bootstrap();
