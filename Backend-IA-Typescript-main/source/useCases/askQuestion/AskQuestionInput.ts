export default interface AskQuestionInput {
    question: string;
    mentorType: "GENERATIVO" | "REFLEXIVO";
    file?: Express.Multer.File;
}