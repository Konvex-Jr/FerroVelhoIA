import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Http from "./Http";
import RagRoutes from "./Routes/RagRoutes";
import TinyRoutes from "./Routes/TinyRoutes";
import Connection from "../database/Connection";

export default class Router {

	protected ragRouter: RagRoutes;
	protected tinyRouter: TinyRoutes;

	constructor(
		readonly http: Http,
		readonly repositoryFactory: RepositoryFactoryInterface,
		readonly connection: Connection
	) {
		this.ragRouter = new RagRoutes(this.http, this.repositoryFactory);
		this.tinyRouter = new TinyRoutes(this.http, this.repositoryFactory, this.connection);
	}

	init() {
		this.http.route("get", "/", false, async (params: any, body: any) => {
			return { message: "welcome" }
		});

		this.ragRouter.init();
		this.tinyRouter.init();
	}
}