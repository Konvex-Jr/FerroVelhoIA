import { Router as ExpressRouter, Request, Response } from "express";
import Router from "../Router";
import RepositoryFactoryInterface from "../../../domain/Interfaces/RepositoryFactoryInterface";
import PostgreSQLConnection from "../../database/PostgreSQLConnection";
import TinyClient from "../../clients/TinyClient";
import ImportAllProducts from "../../../useCases/tiny/ImportAllProducts";
import ApplyTinyDeltaUpdates from "../../../useCases/tiny/ApplyTinyDeltaUpdates";

export default class TinyRoutes {
  constructor(private router: Router, private repositoryFactory: RepositoryFactoryInterface) {}

  init(express: ExpressRouter) {
    // Importação manual completa (one-shot)
    express.post("/tiny/import-all", async (req: Request, res: Response) => {
      try {
        const conn = (this.repositoryFactory as any).connection as PostgreSQLConnection;
        const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
        await new ImportAllProducts(conn, tiny).run();
        res.status(200).json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || String(err) });
      }
    });

    // Aplicar deltas (produtos alterados + atualizações de estoque)
    express.post("/tiny/apply-deltas", async (req: Request, res: Response) => {
      try {
        const conn = (this.repositoryFactory as any).connection as PostgreSQLConnection;
        const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
        await new ApplyTinyDeltaUpdates(conn, tiny).run();
        res.status(200).json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || String(err) });
      }
    });

    // Webhook para atualização de estoque (configure no Tiny)
    express.post("/webhooks/tiny/stock", async (req: Request, res: Response) => {
      try {
        const conn = (this.repositoryFactory as any).connection as PostgreSQLConnection;
        const tiny = new TinyClient(process.env.TINY_API_TOKEN || "");
        const { productId } = (req.body || {}) as any;
        if (!productId) return res.status(400).json({ ok: false, error: "productId ausente" });
        // Reconsulta o estoque detalhado e aplica
        const detail = await tiny.getProductStock(productId);
        const deposits = (detail as any).retorno?.produto?.depositos || [];
        // upsert
        for (const d of deposits) {
          const dep = d.deposito || d;
          await conn.execute(
            `INSERT INTO public.tiny_product_stock (product_id, deposit_code, deposit_name, quantity, updated_at)
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT (product_id, deposit_code) DO UPDATE SET
               deposit_name=EXCLUDED.deposit_name, quantity=EXCLUDED.quantity, updated_at=NOW();`,
            [productId, String(dep.id ?? dep.codigo ?? dep.nome ?? "default"), dep.nome ?? null, dep.saldo ?? dep.quantidade ?? 0]
          );
        }
        res.status(200).json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || String(err) });
      }
    });
  }
}
