import Connection from "../../database/Connection";
import TinyClient from "../../clients/TinyClient";
import ImportAllProducts from "../../../useCases/tiny/ImportAllProducts";
import ApplyTinyDeltaUpdates from "../../../useCases/tiny/ApplyTinyDeltaUpdates";
import Http from "../Http"; 
import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface"; 

export default class TinyRoutes {
  constructor(
    private http: Http, 
    private repositoryFactory: RepositoryFactoryInterface, 
    private connection: Connection 
  ) { }

  init() {
    const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");

    this.http.route("post", "/tiny/import-all", false, async (params: any, body: any) => {
      await new ImportAllProducts(this.repositoryFactory, tiny).run();
      return { ok: true, message: "Importação completa executada." };
    });

    this.http.route("post", "/tiny/apply-deltas", false, async (params: any, body: any) => {
      await new ApplyTinyDeltaUpdates(this.repositoryFactory, tiny).run(); 
      return { ok: true, message: "Deltas aplicados." };
    });
  }
}