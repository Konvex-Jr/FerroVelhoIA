export default interface AskQuestionInput {
    question: string;
    userId: string;
    conversationId?: string;
    file?: Express.Multer.File;
}
