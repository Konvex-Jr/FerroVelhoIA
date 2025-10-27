import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import AskQuestion from "../../useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../../useCases/askQuestion/AskQuestionInput";
import AskQuestionOutput from "../../useCases/askQuestion/AskQuestionOutput";

export default class RagController {

    constructor(protected repositoryFactory: RepositoryFactoryInterface) {
    }

    async askQuestion(input: AskQuestionInput): Promise<AskQuestionOutput> {
        const askQuestion = new AskQuestion(this.repositoryFactory);
        return await askQuestion.execute(input);
    }
}