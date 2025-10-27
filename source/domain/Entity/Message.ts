import { v4 as uuid } from "uuid";

export type MessageRole = "system" | "user" | "assistant";

export default class Message {
    readonly id: string;
    readonly chatId: string;
    readonly role: MessageRole;
    readonly content: string;
    readonly createdAt: Date;
    readonly orderIndex: number;

    constructor(
        chatId: string,
        role: MessageRole,
        content: string,
        orderIndex: number,
        id?: string,
        createdAt?: Date
    ) {
        this.id = id || uuid();
        this.chatId = chatId;
        this.role = role;
        this.content = content;
        this.createdAt = createdAt || new Date();
        this.orderIndex = orderIndex;
    }
}
