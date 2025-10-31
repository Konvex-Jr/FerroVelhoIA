import { config } from "dotenv";

import PostgreSQLConnection from "./infra/database/PostgreSQLConnection";
import ExpressHttp from "./infra/http/ExpressHttp";
import Router from "./infra/http/Router";
import DatabaseRepositoryFactory from "./infra/repository/DatabaseRepositoryFactory";
import ExpressAuth from "./infra/http/Middleware/AuthExpress";
import CreateUsersTable from "./infra/migrations/01.create_users_table";
import CreateTokensTable from "./infra/migrations/02.create_tokens_table";
import CreateChunksTable from "./infra/migrations/03.create_chunks_table";
import CreateMessagesTable from "./infra/migrations/05.create_messages_table";
import CreateConversationsTable from "./infra/migrations/04.create_conversations_table";
import CreateFeedbacksTable from "./infra/migrations/06.create_feedbacks_table";

config();

async function bootstrap() {
    const connection = new PostgreSQLConnection({
        user: process.env.DB_USERNAME ?? '',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_DATABASE ?? '',
        host: process.env.DB_HOST ?? '',
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432
    });

    try {
        const usersMigration = new CreateUsersTable(connection);
        await usersMigration.up();
        console.log("Migration 'users' executada com sucesso!");

        const tokensMigration = new CreateTokensTable(connection);
        await tokensMigration.up();
        console.log("Migration 'tokens' executada com sucesso!");

        const chunksMigration = new CreateChunksTable(connection);
        await chunksMigration.up();
        console.log("Migration 'chunks' executada com sucesso!");

        const conversationsMigration = new CreateConversationsTable(connection);
        await conversationsMigration.up();
        console.log("Migration 'conversations' executada com sucesso!");

        const messagesMigration = new CreateMessagesTable(connection);
        await messagesMigration.up();
        console.log("Migration 'messages' executada com sucesso!");

        const feedbacksMigration = new CreateFeedbacksTable(connection);
        await feedbacksMigration.up();
        console.log("Migration 'feedbacks' executada com sucesso!");

    } catch (err) {
        console.error("Erro ao rodar as migrations:", err);
    }

    const repositoryFactory = new DatabaseRepositoryFactory(connection);
    const auth = new ExpressAuth(repositoryFactory);
    const http = new ExpressHttp(auth);
    const router = new Router(http, repositoryFactory);

    router.init();
    http.listen(5001);
    console.log('Running...');
}

bootstrap();