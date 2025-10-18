import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import UserRoutes from "./Routes/UserRoutes";
export default class Router {

	protected userRoutes: UserRoutes;

	constructor(readonly http: Http, readonly repositoryFactory: RepositoryFactoryInterface) {
		this.userRoutes = new UserRoutes(this.http, this.repositoryFactory);
	}

	init() {
		this.http.route("get", "/", true, async (params: any, body: any) => {
			return {
				message: "welcome"
			}
		});
		this.userRoutes.init();
	}
}