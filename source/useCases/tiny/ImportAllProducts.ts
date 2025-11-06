import Connection from "../../infra/database/Connection";
import TinyClient from "../../infra/clients/TinyClient";

const MAX_PAGES_PER_RUN = Number(process.env.FALLBACK_MAX_PAGES_PER_RUN ?? "4");
const RATE_LIMIT_SLEEP_MS = Number(process.env.FALLBACK_RATE_LIMIT_SLEEP_MS ?? "60000");
const JITTER_MS = Number(process.env.FALLBACK_JITTER_MS ?? "400");
const PAGE_DELAY_MS = Number(process.env.FALLBACK_PAGE_DELAY_MS ?? "800");

export default class ImportAllProducts {
  constructor(private connection: Connection, private tiny: TinyClient) {}

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
  private jitter() { return Math.floor(Math.random() * JITTER_MS); }

  async run(): Promise<void> {
    let page = await this.getStateNumber("import:next_page", 1);
    let processed = 0;
    let totalPages = page;

    while (processed < MAX_PAGES_PER_RUN) {
      let resp: any;
      try {
        resp = await this.tiny.searchProducts({ pesquisa: "", pagina: page });
      } catch (e: any) {
        const msg = e?.response?.data ?? e?.message ?? String(e);
        if (msg.includes("API Bloqueada") || e?.response?.status === 429) {
          console.warn(`[import] rate limit na página ${page}. Aguardando ${RATE_LIMIT_SLEEP_MS}ms…`);
          await this.sleep(RATE_LIMIT_SLEEP_MS + this.jitter());
          await this.setState("import:next_page", String(page));
          return; // encerra ciclo atual, retoma no próximo
        }
        console.warn(`[import] erro na página ${page}:`, msg);
        await this.setState("import:next_page", String(page + 1));
        return;
      }

      const r = resp?.retorno;
      if (!r || r.status !== "OK") {
        const msg = r?.erros?.map((x: any) => x?.erro).join("; ") || "Erro desconhecido";
        if (msg.includes("API Bloqueada")) {
          console.warn(`[import] bloqueado na página ${page}. Aguardando ${RATE_LIMIT_SLEEP_MS}ms…`);
          await this.sleep(RATE_LIMIT_SLEEP_MS + this.jitter());
          await this.setState("import:next_page", String(page));
          return;
        }
        console.warn(`[import] falha na página ${page}: ${msg}`);
        await this.setState("import:next_page", String(page + 1));
        return;
      }

      totalPages = Number(r.numero_paginas || page);
      const produtos = r.produtos ?? [];
      if (!Array.isArray(produtos) || produtos.length === 0) {
        await this.setState("import:next_page", "1"); // catálago acabou; recomeça
        return;
      }

      for (const item of produtos) {
        const p = item?.produto;
        if (!p?.id) continue;

        await this.upsertProductRow(p);

        // Estoque total (opcional na importação; pode ficar 0 e ser atualizado via deltas)
        try {
          const detail = await this.tiny.getProduct(p.id);
          const prod = detail?.retorno?.produto;
          if (prod) {
            await this.upsertProductRow(prod);           // atualiza cadastro com dados do detalhe
            const qty = this.coerceTotalStock(prod);     // calcula estoque total
            await this.upsertQuantity(p.id, qty, "default");
          }
        } catch (e: any) {
          // Se falhar detalhe, deixa quantity=0 por enquanto
          await this.upsertQuantity(p.id, 0, "default");
        }
      }

      processed++;
      page++;
      if (page > totalPages) {
        await this.setState("import:next_page", "1");
        console.log(`[import] catálogo completo varrido (${totalPages} páginas).`);
        return;
      } else {
        await this.setState("import:next_page", String(page));
      }

      await this.sleep(PAGE_DELAY_MS + this.jitter());
    }

    console.log(`[import] ciclo parcial finalizado. Próxima página: ${page}`);
  }

  private coerceTotalStock(p: any): number {
    const candidates = [p.estoque_atual, p.saldo, p.estoque, p.saldoEstoque, p.estoqueAtual];
    for (const v of candidates) {
      const n = Number(String(v ?? "").toString().replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  private async upsertQuantity(productId: number, quantity: number, depositCode: string | null) {
    await this.connection.execute(
      `UPDATE public.tiny_products
         SET quantity = $2,
             deposit_code = $3,
             updated_at = NOW()
       WHERE id = $1;`,
      [productId, quantity ?? 0, depositCode]
    );
  }

  private async upsertProductRow(p: any) {
    await this.connection.execute(
      `INSERT INTO public.tiny_products (
         id, code, name, sku, gtin, unit, price, promo_price, cost_price, avg_cost_price,
         location, status, created_at_tiny, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         to_timestamp(NULLIF($13,'')::text, 'DD/MM/YYYY HH24:MI:SS'),
         NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         code=EXCLUDED.code,
         name=EXCLUDED.name,
         sku=EXCLUDED.sku,
         gtin=EXCLUDED.gtin,
         unit=EXCLUDED.unit,
         price=EXCLUDED.price,
         promo_price=EXCLUDED.promo_price,
         cost_price=EXCLUDED.cost_price,
         avg_cost_price=EXCLUDED.avg_cost_price,
         location=EXCLUDED.location,
         status=EXCLUDED.status,
         created_at_tiny=EXCLUDED.created_at_tiny,
         updated_at=NOW();`,
      [
        p.id, p.codigo ?? null, p.nome ?? null, p.codigo ?? null, p.gtin ?? null, p.unidade ?? null,
        p.preco ?? null, p.preco_promocional ?? null, p.preco_custo ?? null, p.preco_custo_medio ?? null,
        p.localizacao ?? null, p.situacao ?? null, p.data_criacao ?? null
      ]
    );
  }

  // --- state helpers (sem usar .query) ---
  private async getStateNumber(key: string, fallback: number): Promise<number> {
    const result: any = await this.connection.execute(
      "SELECT value FROM public.tiny_sync_state WHERE key = $1",
      [key]
    );
    const rows = Array.isArray(result) ? result
      : result?.rows ?? result?.data ?? Object.values(result ?? {}).find(Array.isArray) ?? [];
    const raw = rows?.[0]?.value;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? n : fallback;
  }

  private async setState(key: string, value: string): Promise<void> {
    await this.connection.execute(
      `INSERT INTO public.tiny_sync_state(key, value, updated_at)
       VALUES($1,$2,NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      [key, value]
    );
  }
}
