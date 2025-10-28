import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import RagRoutes from "./Routes/RagRoutes";
import UserRoutes from "./Routes/UserRoutes";
export default class Router {

	protected userRoutes: UserRoutes;
	protected ragRoutes: RagRoutes;

	constructor(readonly http: Http, readonly repositoryFactory: RepositoryFactoryInterface) {
		this.userRoutes = new UserRoutes(this.http, this.repositoryFactory);
		this.ragRoutes = new RagRoutes(this.http, this.repositoryFactory);
	}

	init() {
		this.http.route("get", "/", true, async (params: any, body: any) => {
			return {
				message: "welcome"
			}
		});
		this.userRoutes.init();
		this.ragRoutes.init();
	}
}