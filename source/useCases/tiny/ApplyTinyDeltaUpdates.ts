import Connection from "../../infra/database/Connection";
import TinyClient from "../../infra/clients/TinyClient";

export default class ApplyTinyDeltaUpdates {
  constructor(private connection: Connection, private tiny: TinyClient) {}

  async run(): Promise<void> {
    // 1) produtos alterados -> atualizar cadastro
    try {
      const changed = await this.tiny.listChangedProducts();
      if (changed.retorno?.produtos) {
        for (const item of changed.retorno.produtos) {
          const id = item?.produto?.id || item?.id;
          if (!id) continue;
          const detail = await this.tiny.getProduct(id);
          const p = detail.retorno?.produto;
          if (p) await this.upsertProductRow(p);
        }
      }
    } catch (e: any) {
      console.warn("Falha ao aplicar delta de produtos:", e?.message ?? e);
    }

    // 2) atualizações de estoque -> atualizar saldos por depósito
    try {
      const stock = await this.tiny.listStockUpdates();
      if (stock.retorno?.produtos) {
        for (const item of stock.retorno.produtos) {
          const p = item.produto;
          const detail = await this.tiny.getProductStock(p.id);
          const deposits = detail.retorno?.produto?.depositos || [];
          await this.upsertStockRows(p.id, deposits);
        }
      }
    } catch (e: any) {
      console.warn("Falha ao aplicar delta de estoque:", e?.message ?? e);
    }
  }

  private async upsertProductRow(p: any) {
    await this.connection.execute(
      `INSERT INTO public.tiny_products (id, code, name, sku, gtin, unit, price, promo_price, cost_price, avg_cost_price, location, status, created_at_tiny, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, to_timestamp(COALESCE(NULLIF($13,''), '')::text, 'DD/MM/YYYY HH24:MI:SS'), NOW())
       ON CONFLICT (id) DO UPDATE SET
         code=EXCLUDED.code, name=EXCLUDED.name, sku=EXCLUDED.sku, gtin=EXCLUDED.gtin, unit=EXCLUDED.unit,
         price=EXCLUDED.price, promo_price=EXCLUDED.promo_price, cost_price=EXCLUDED.cost_price, avg_cost_price=EXCLUDED.avg_cost_price,
         location=EXCLUDED.location, status=EXCLUDED.status, created_at_tiny=EXCLUDED.created_at_tiny, updated_at=NOW();`,
      [
        p.id, p.codigo, p.nome, p.codigo, p.gtin, p.unidade,
        p.preco, p.preco_promocional, p.preco_custo, p.preco_custo_medio,
        p.localizacao, p.situacao, p.data_criacao || null
      ]
    );
  }

  private async upsertStockRows(productId: number, deposits: any[]) {
    for (const d of (deposits || [])) {
      const dep = d.deposito || d;
      await this.connection.execute(
        `INSERT INTO public.tiny_product_stock (product_id, deposit_code, deposit_name, quantity, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (product_id, deposit_code) DO UPDATE SET
           deposit_name=EXCLUDED.deposit_name,
           quantity=EXCLUDED.quantity,
           updated_at=NOW();`,
        [productId, String(dep.id ?? dep.codigo ?? dep.nome ?? "default"), dep.nome ?? null, dep.saldo ?? dep.quantidade ?? 0]
      );
    }
  }
}
