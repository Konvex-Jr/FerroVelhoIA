import RepositoryFactory from "../../../domain/Interfaces/RepositoryFactoryInterface";
import RagController from "../../controller/RagController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import AskQuestion from "../../../useCases/askQuestion/AskQuestion";

export default class RagRoutes implements ModelRoutes {

    protected ragController: RagController;

    constructor(readonly http: Http, repositoryFactory: RepositoryFactory) {

        const askQuestionUseCase = new AskQuestion(repositoryFactory);
        
        this.ragController = new RagController(askQuestionUseCase);
    }

    init(): void {
        this.http.route("post", "/ask", false, async (params: any, body: any) => {
            return await this.ragController.askQuestion(body);
        });
    }
}