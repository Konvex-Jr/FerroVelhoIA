import Conversation from "../../../domain/Entity/Conversation";
import Message from "../../../domain/Entity/Message";
import ConversationRepositoryInterface from "../../../domain/Interfaces/ConversationRepositoryInterface";

export default class ConversationRepositoryMemory implements ConversationRepositoryInterface {
    private conversations: Conversation[] = [];
    private messages: Message[] = [];

    async create(conversation: Conversation): Promise<void> {
        this.conversations.push(conversation);
    }

    async findByUser(userId: string): Promise<Conversation[]> {
        return this.conversations.filter(c => c.userId === userId);
    }

    async findById(id: string): Promise<Conversation | null> {
        const conv = this.conversations.find(c => c.id === id);
        return conv || null;
    }

    async addMessage(conversationId: string, message: Message): Promise<void> {
        this.messages.push(message);
    }

    async getMessages(conversationId: string): Promise<Message[]> {
        return this.messages
            .filter(m => m.chatId === conversationId)
            .sort((a, b) => a.orderIndex - b.orderIndex);
    }
}
