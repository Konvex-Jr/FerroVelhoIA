import Connection from "../../infra/database/Connection";
import TinyClient from "../../infra/clients/TinyClient";

function toNumber(val: any): number {
  if (val == null) return 0;
  const s = String(val).replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default class ApplyTinyDeltaUpdates {
  constructor(private connection: Connection, private tiny: TinyClient) {}

  private async getLastSync(): Promise<string | null> {
    const rows: any[] = await this.connection.execute(
      "SELECT value FROM public.tiny_sync_state WHERE key = $1",
      ["incremental:last_sync_at"]
    );
    return rows?.[0]?.value ?? null;
  }

  private async setLastSync(value: string): Promise<void> {
    await this.connection.execute(
      `INSERT INTO public.tiny_sync_state (key, value, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();`,
      ["incremental:last_sync_at", value]
    );
  }

  private nowBR(): string {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async run(): Promise<void> {
    // 1) delta de CADASTRO (opcional): lista de produtos alterados
    try {
      const changed = await this.tiny.listChangedProducts(); // se já tiver este método
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

    // 2) delta de ESTOQUE: lista.atualizacoes.estoque desde last_sync_at
    const since = (await this.getLastSync()) || "01/01/2000 00:00:00";
    let page = 1;
    while (true) {
      let stockUpdates: any;
      try {
        stockUpdates = await this.tiny.listStockUpdates({ dataAlteracao: since, pagina: page });
      } catch (e: any) {
        console.warn("Falha ao consultar lista.atualizacoes.estoque:", e?.message ?? e);
        break;
      }

      const r = stockUpdates?.retorno;
      if (!r || r.status !== "OK") break;

      const items = r.produtos ?? [];
      for (const it of items) {
        const pid = it?.produto?.id || it?.id;
        if (!pid) continue;
        try {
          const detail = await this.tiny.getProductStock(pid);
          // formatos: retorno.estoques[]  OU retorno.produto.depositos[]
          const estoques = detail?.retorno?.estoques
                        || detail?.retorno?.produto?.depositos
                        || [];
          await this.updateProductQuantity(pid, estoques);
        } catch (e: any) {
          console.warn(`Falha ao obter estoque do produto ${pid}:`, e?.message ?? e);
        }
      }

      const total = Number(r.numero_paginas || 1);
      if (page >= total) break;
      page++;
    }

    await this.setLastSync(this.nowBR());
    console.log("Deltas aplicados.");
  }

  private async upsertProductRow(p: any) {
    await this.connection.execute(
      `INSERT INTO public.tiny_products
         (id, code, name, sku, gtin, unit, price, promo_price, cost_price, avg_cost_price, location, status, created_at_tiny, updated_at)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,to_timestamp(NULLIF($13,'')::text, 'DD/MM/YYYY HH24:MI:SS'), NOW())
       ON CONFLICT (id) DO UPDATE SET
         code=EXCLUDED.code, name=EXCLUDED.name, sku=EXCLUDED.sku, gtin=EXCLUDED.gtin, unit=EXCLUDED.unit,
         price=EXCLUDED.price, promo_price=EXCLUDED.promo_price, cost_price=EXCLUDED.cost_price, avg_cost_price=EXCLUDED.avg_cost_price,
         location=EXCLUDED.location, status=EXCLUDED.status, created_at_tiny=EXCLUDED.created_at_tiny, updated_at=NOW();`,
      [
        p.id, p.codigo ?? null, p.nome ?? null, p.codigo ?? null, p.gtin ?? null, p.unidade ?? null,
        p.preco ?? null, p.preco_promocional ?? null, p.preco_custo ?? null, p.preco_custo_medio ?? null,
        p.localizacao ?? null, p.situacao ?? null, p.data_criacao ?? null
      ]
    );
  }

  private async updateProductQuantity(productId: number | string, estoques: any[]) {
    // soma total dos depósitos (se vier no formato 'depositos') ou do array 'estoques'
    const list = Array.isArray(estoques) ? estoques : [];
    const total = list.reduce((acc, e) => {
      const saldo = e?.deposito?.saldo ?? e?.saldo ?? e?.quantidade ?? 0;
      return acc + toNumber(saldo);
    }, 0);

    const first = list[0]?.deposito || list[0] || {};
    const depCode = String(first.codigo_deposito ?? first.id ?? first.codigo ?? "default");

    await this.connection.execute(
      `UPDATE public.tiny_products
         SET quantity = $2,
             deposit_code = $3,
             updated_at = NOW()
       WHERE id = $1;`,
      [productId, total, depCode]
    );
  }
}
