import RepositoryFactory from "../../../domain/Interfaces/RepositoryFactoryInterface";
import RagController from "../../controller/RagController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import AskQuestion from "../../../useCases/askQuestion/AskQuestion"; // IMPORT ADICIONADO

export default class RagRoutes implements ModelRoutes {

    protected ragController: RagController;

    constructor(readonly http: Http, repositoryFactory: RepositoryFactory) {
        // MUDANÇA AQUI: O use case é criado UMA VEZ
        const askQuestionUseCase = new AskQuestion(repositoryFactory);
        
        // MUDANÇA AQUI: O controller recebe o use case pronto
        this.ragController = new RagController(askQuestionUseCase);
    }

    init(): void {
        this.http.route("post", "/ask", false, async (params: any, body: any) => {
            return await this.ragController.askQuestion(body);
        });
    }
}