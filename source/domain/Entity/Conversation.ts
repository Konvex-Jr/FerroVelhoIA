import { v4 as uuid } from "uuid";
import Message from "./Message";

export default class Conversation {
    readonly id: string;
    readonly userId: string;
    title?: string;
    messages: Message[] = [];

    constructor(userId: string, title?: string, id?: string) {
        this.id = id || uuid();
        this.userId = userId;
        this.title = title;
    }

    addMessage(message: Message): void {
        this.messages.push(message);
    }
}
