import CreateFeedbackInput from "./CreateFeedbackInput";

export interface CreateFeedbackOutput {
    execute(input: CreateFeedbackInput): Promise<void>;
}