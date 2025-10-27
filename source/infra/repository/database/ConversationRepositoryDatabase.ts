import Conversation from "../../../domain/Entity/Conversation";
import Message from "../../../domain/Entity/Message";
import ConversationRepositoryInterface from "../../../domain/Interfaces/ConversationRepositoryInterface";
import Connection from "../../database/Connection";

export default class ConversationRepositoryDatabase implements ConversationRepositoryInterface {
    constructor(protected connection: Connection) {}

    async create(conversation: Conversation): Promise<void> {
        await this.connection.execute(
            "INSERT INTO public.conversations (id, user_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);",
            [conversation.id, conversation.userId, conversation.title, new Date(), new Date()]
        );
    }

    async findByUser(userId: string): Promise<Conversation[]> {
        const rows = await this.connection.execute(
            "SELECT * FROM public.conversations WHERE user_id = $1 ORDER BY created_at ASC;",
            [userId]
        );
        return rows.map((r: any) => new Conversation(r.user_id, r.title, r.id));
    }

    async findById(id: string): Promise<Conversation | null> {
        const rows = await this.connection.execute(
            "SELECT * FROM public.conversations WHERE id = $1;",
            [id]
        );
        if (!rows.length) return null;
        const r = rows[0];
        return new Conversation(r.user_id, r.title, r.id);
    }

    async addMessage(conversationId: string, message: Message): Promise<void> {
        await this.connection.execute(
            "INSERT INTO public.messages (id, conversation_id, role, content, order_index, created_at) VALUES ($1, $2, $3, $4, $5, $6);",
            [message.id, conversationId, message.role, message.content, message.orderIndex, message.createdAt]
        );
    }

    async getMessages(conversationId: string): Promise<Message[]> {
        const rows = await this.connection.execute(
            "SELECT * FROM public.messages WHERE conversation_id = $1 ORDER BY order_index ASC;",
            [conversationId]
        );
        return rows.map((r: any) => new Message(r.conversation_id, r.role, r.content, r.order_index, r.id, r.created_at));
    }
}
