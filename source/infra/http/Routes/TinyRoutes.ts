// source/infra/http/Routes/TinyRoutes.ts
import Connection from "../../database/Connection";
import TinyClient from "../../clients/TinyClient";
import ImportAllProducts from "../../../useCases/tiny/ImportAllProducts";
import ApplyTinyDeltaUpdates from "../../../useCases/tiny/ApplyTinyDeltaUpdates";

export default class TinyRoutes {
  constructor(
    private app: any,                 // Express app ou seu wrapper compatível com .post(...)
    private connection: Connection
  ) {}

  init() {
    const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");

    // 1) Importação completa (executa uma única vez quando você chamar)
    this.app.post("/tiny/import-all", async (_req: any, res: any) => {
      try {
        await new ImportAllProducts(this.connection, tiny).run();
        res.status(200).json({ ok: true, message: "Importação completa executada." });
      } catch (e: any) {
        console.error(e);
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });

    // 2) Deltas incrementais de estoque (usa lista.atualizacoes.estoque)
    this.app.post("/tiny/apply-deltas", async (_req: any, res: any) => {
      try {
        await new ApplyTinyDeltaUpdates(this.connection, tiny).run();
        res.status(200).json({ ok: true, message: "Deltas aplicados." });
      } catch (e: any) {
        console.error(e);
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      }
    });

  }
}
