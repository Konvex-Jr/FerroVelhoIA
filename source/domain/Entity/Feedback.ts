import { v4 as uuid } from "uuid";

export default class Feedback {
    readonly id: string;
    readonly messageId: string;
    readonly rating: number;
    readonly comment: string;

    constructor(messageId: string, rating: number, comment: string, id?: string) {
        if (rating < 0 || rating > 5) {
            throw new Error("Rating must be an integer between 0 and 5.");
        }
        this.id = id || uuid();
        this.messageId = messageId;
        this.rating = rating;
        this.comment = comment;
    }
}
