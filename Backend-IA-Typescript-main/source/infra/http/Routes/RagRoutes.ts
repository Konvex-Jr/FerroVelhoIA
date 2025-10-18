import RepositoryFactory from "../../../domain/Interfaces/RepositoryFactoryInterface";
import RagController from "../../controller/RagController";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";

export default class RagRoutes implements ModelRoutes {

    protected ragController: RagController;

    constructor(readonly http: Http, repositoryFactory: RepositoryFactory) {
        this.ragController = new RagController(repositoryFactory);
    }

    init(): void {
        this.http.route("post", "/ask", false, async (params: any, body: any) => {
            return await this.ragController.askQuestion(body);
        });
    }
}