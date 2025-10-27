import Conversation from "../Entity/Conversation";
import Message from "../Entity/Message";

export default interface ConversationRepositoryInterface {
    create(chat: Conversation): Promise<void>;
    findByUser(userId: string): Promise<Conversation[]>;
    findById(id: string): Promise<Conversation | null>;
    addMessage(chatId: string, message: Message): Promise<void>;
    getMessages(chatId: string): Promise<Message[]>;
}
