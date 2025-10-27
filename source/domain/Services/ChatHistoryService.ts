import Message from "../Entity/Message";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import ChatRepositoryInterface from "../Interfaces/ConversationRepositoryInterface";
import Conversation from "../Entity/Conversation";

export default class ChatHistoryService {
    private chatRepository: ChatRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.chatRepository = repositoryFactory.createConversationRepository();
    }

    async createConversation(userId: string, title?: string): Promise<Conversation> {
        const conversation = new Conversation(userId, title);
        await this.chatRepository.create(conversation);
        return conversation;
    }

    async getConversationById(conversationId: string): Promise<Conversation | null> {
        return await this.chatRepository.findById(conversationId);
    }

    async getConversationsByUser(userId: string): Promise<Conversation[]> {
        return await this.chatRepository.findByUser(userId);
    }

    async addMessage(conversationId: string, role: "system" | "user" | "assistant", content: string): Promise<Message> {
        const messages = await this.chatRepository.getMessages(conversationId);
        const message = new Message(conversationId, role, content, messages.length);
        await this.chatRepository.addMessage(conversationId, message);
        return message;
    }

    async getChatHistory(conversationId: string): Promise<Message[]> {
        const messages = await this.chatRepository.getMessages(conversationId);
        return messages.sort((a, b) => a.orderIndex - b.orderIndex);
    }
}
