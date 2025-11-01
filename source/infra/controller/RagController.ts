import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import AskQuestion from "../../useCases/askQuestion/AskQuestion";
import AskQuestionInput from "../../useCases/askQuestion/AskQuestionInput";
import AskQuestionOutput from "../../useCases/askQuestion/AskQuestionOutput";

export default class RagController {

    constructor(protected askQuestionUseCase: AskQuestion) {
    }

    async askQuestion(input: AskQuestionInput): Promise<AskQuestionOutput> {
        return await this.askQuestionUseCase.execute(input);
    }
}