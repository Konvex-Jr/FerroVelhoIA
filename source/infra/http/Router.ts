import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import RagRoutes from "./Routes/RagRoutes";
export default class Router {

	protected ragRouter: RagRoutes;

	constructor(readonly http: Http, readonly repositoryFactory: RepositoryFactoryInterface) {
		this.ragRouter = new RagRoutes(this.http, this.repositoryFactory);
	}

	init() {
		this.http.route("get", "/", false, async (params: any, body: any) => {
			return {
				message: "welcome"
			}
		});
		this.ragRouter.init();
	}
}