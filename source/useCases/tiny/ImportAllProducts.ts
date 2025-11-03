import Connection from "../../infra/database/Connection";
import TinyClient from "../../infra/clients/TinyClient";

export default class ImportAllProducts {
  constructor(private connection: Connection, private tiny: TinyClient) {}

  async run(): Promise<void> {
    let page = 1;
    while (true) {
      const resp = await this.tiny.searchProducts({ pesquisa: "", pagina: page });
      const r = resp.retorno;
      if (r.status !== "OK") {
        console.error("Erro pesquisando produtos:", r.erros?.map((e: { erro: string }) => e.erro).join("; "));
        break;
      }
      const produtos = r.produtos ?? [];
      for (const item of produtos) {
        const p = item.produto;
        await this.upsertProductRow(p);
        // estoque detalhado por depósito
        try {
          const est = await this.tiny.getProductStock(p.id);
          const deposits = est.retorno?.produto?.depositos || [];
          await this.upsertStockRows(p.id, deposits);
        } catch (e: any) {
          console.warn("Falha ao obter estoque do produto", p.id, e?.message ?? e);
        }
      }
      if (!r.numero_paginas || page >= r.numero_paginas) break;
      page++;
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
    // deposits: [{ deposito: { id: 1, nome: 'Matriz', saldo: 10 } }]
    for (const d of (deposits || [])) {
      const dep = d.deposito || d; // alguns retornos podem vir achatados
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
