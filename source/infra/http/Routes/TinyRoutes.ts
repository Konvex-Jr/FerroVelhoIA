// source/infra/http/Routes/TinyRoutes.ts
import TinyClient from "../../clients/TinyClient";
import Connection from "../../database/Connection";
import ImportAllProducts from "../../../useCases/tiny/ImportAllProducts";
import ApplyTinyDeltaUpdates from "../../../useCases/tiny/ApplyTinyDeltaUpdates";
import ApplyTinyPaginationSync from "../../../useCases/tiny/ApplyTinyPaginationSync";

type AnyHttp = any;

export default class TinyRoutes {
  private app: any;
  private connection: Connection;
  private tiny: TinyClient;

  constructor(httpOrApp: AnyHttp, connection: Connection) {
    // tenta extrair a instância do Express de várias formas comuns
    const candidate =
      httpOrApp?.app ??
      httpOrApp?.express ??
      (typeof httpOrApp?.getApp === "function" ? httpOrApp.getApp() : undefined) ??
      httpOrApp;

    if (!candidate || typeof candidate.post !== "function") {
      throw new Error(
        "TinyRoutes: Express app não encontrado. Forneça o app (ou um wrapper com .app/.express/.getApp())."
      );
    }

    this.app = candidate;
    this.connection = connection;
    this.tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
  }

  init() {
    // Importa TODO o catálogo (censo inicial)
    this.app.post("/tiny/import-all", async (_req: any, res: any) => {
      try {
        await new ImportAllProducts(this.connection, this.tiny).run();
        res.status(200).json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });

    // Aplica DELTAS (usa endpoints de alterações do Tiny)
    this.app.post("/tiny/apply-deltas", async (_req: any, res: any) => {
      try {
        await new ApplyTinyDeltaUpdates(this.connection, this.tiny).run();
        res.status(200).json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });

    // FALLBACK por paginação (quando não há deltas/estoque habilitado)
    this.app.post("/tiny/apply-fallback", async (_req: any, res: any) => {
      try {
        await new ApplyTinyPaginationSync(this.connection, this.tiny).run();
        res.status(200).json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });
  }
}
