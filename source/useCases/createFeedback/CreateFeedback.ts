import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import CreateFeedbackInput from "./CreateFeedbackInput";
import Feedback from "../../domain/Entity/Feedback";
import FeedbackRepositoryInterface from "../../domain/Interfaces/FeedbackRepositoryInterface";

export default class CreateFeedback {

    readonly feedbackRepository: FeedbackRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.feedbackRepository = repositoryFactory.createFeedbackRepository();
    }

    async execute(input: CreateFeedbackInput): Promise<void> {
        if (!input.messageId) throw new Error("Invalid message ID");
        if (input.rating < 1 || input.rating > 5) throw new Error("Invalid rating");
        if (!input.comment) throw new Error("Invalid comment");

        const feedback = new Feedback(input.messageId, input.rating, input.comment);
        await this.feedbackRepository.create(feedback);
    }
}