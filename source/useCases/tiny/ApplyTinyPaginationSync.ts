import Connection from "../../infra/database/Connection";
import TinyClient from "../../infra/clients/TinyClient";

/**
 * Fallback por paginação (SEM produto.estoque.php), com:
 * - Rate limit/backoff + jitter
 * - Paginação limitada por ciclo
 * - Estado persistente (retoma da próxima página no próximo ciclo)
 *
 * Tabelas envolvidas:
 * - public.tiny_products
 * - public.tiny_product_stock  (depósito único "default")
 * - public.tiny_sync_state     (keys: fallback:next_page)
 *
 * OBS: usa APENAS this.connection.execute(...) (nenhum uso de .query()).
 */
export default class ApplyTinyPaginationSync {
  constructor(private connection: Connection, private tiny: TinyClient) {}

  private MAX_PAGES_PER_RUN =
    Number(process.env.FALLBACK_MAX_PAGES_PER_RUN ?? "4");
  private PAGE_DELAY_MS =
    Number(process.env.FALLBACK_PAGE_DELAY_MS ?? "800");
  private RATE_LIMIT_SLEEP_MS =
    Number(process.env.FALLBACK_RATE_LIMIT_SLEEP_MS ?? "60000");
  private JITTER_MS =
    Number(process.env.FALLBACK_JITTER_MS ?? "400");

  async run(): Promise<void> {
    // 1) Descobrir de qual página devo começar (estado persistente)
    let page = await this.getNextPage();
    if (page < 1) page = 1;

    let processed = 0;
    let totalPages = page; // atualizado após a 1ª resposta

    while (processed < this.MAX_PAGES_PER_RUN) {
      // 2) Busca da página
      let resp: any;
      try {
        resp = await this.tiny.searchProducts({ pesquisa: "", pagina: page });
      } catch (e: any) {
        const msg = e?.response?.data ?? e?.message ?? String(e);
        if (
          e?.response?.status === 429 ||
          (typeof msg === "string" && msg.includes("API Bloqueada"))
        ) {
          console.warn(
            `[fallback] rate limit na página ${page}. Dormindo ${this.RATE_LIMIT_SLEEP_MS}ms...`
          );
          await this.sleep(this.RATE_LIMIT_SLEEP_MS + this.randomJitter());
          await this.setNextPage(page);
          break;
        }
        console.warn(`[fallback] erro na pesquisa página ${page}:`, msg);
        await this.setNextPage(page + 1);
        break;
      }

      const r = resp?.retorno;
      if (!r || r.status !== "OK") {
        const msg = r?.erros?.map((x: any) => x?.erro).join("; ") || "Erro desconhecido";
        if (msg.includes("API Bloqueada")) {
          console.warn(
            `[fallback] bloqueado na página ${page}. Dormindo ${this.RATE_LIMIT_SLEEP_MS}ms...`
          );
          await this.sleep(this.RATE_LIMIT_SLEEP_MS + this.randomJitter());
          await this.setNextPage(page);
          break;
        }
        console.warn(`[fallback] pesquisa página ${page} falhou: ${msg}`);
        await this.setNextPage(page + 1);
        break;
      }

      totalPages = Number(r.numero_paginas || page);
      const produtos = r.produtos ?? [];
      if (!Array.isArray(produtos) || produtos.length === 0) {
        await this.setNextPage(1); // ciclo completo
        break;
      }

      // 3) Processa itens da página
      for (const item of produtos) {
        const pList = item?.produto;
        if (!pList?.id) continue;

        // cadastro básico da listagem
        await this.upsertProductRowFromList(pList);

        // detalhe do produto (para capturar estoque total)
        try {
          const detail = await this.tiny.getProduct(pList.id);
          const p = detail?.retorno?.produto;
          if (p) {
            await this.upsertProductRowFromDetail(p);
            const totalQty = this.coerceTotalStock(p);
            await this.upsertDefaultStock(p.id, totalQty);
          } else {
            await this.upsertDefaultStock(pList.id, 0);
          }
        } catch (e: any) {
          const msg = e?.response?.data ?? e?.message ?? String(e);
          if (
            e?.response?.status === 429 ||
            (typeof msg === "string" && msg.includes("API Bloqueada"))
          ) {
            console.warn(
              `[fallback] rate limit ao obter produto ${pList.id}. Dormindo ${this.RATE_LIMIT_SLEEP_MS}ms...`
            );
            await this.sleep(this.RATE_LIMIT_SLEEP_MS + this.randomJitter());
            await this.setNextPage(page);
            return;
          }
          console.warn(`[fallback] obter produto ${pList.id} falhou:`, msg);
          await this.upsertDefaultStock(pList.id, 0);
        }
      }

      // 4) Avança estado e respeita delay entre páginas
      processed++;
      page++;

      if (page > totalPages) {
        await this.setNextPage(1); // fim do catálogo -> recomeça no próximo ciclo
        break;
      } else {
        await this.setNextPage(page);
      }

      await this.sleep(this.PAGE_DELAY_MS + this.randomJitter());
      if (processed >= this.MAX_PAGES_PER_RUN) break;
    }

    console.log("[fallback] sincronização sem produto.estoque.php finalizada.");
  }

  // ===== Persistência de estado (USANDO APENAS execute) =====

  private async getNextPage(): Promise<number> {
    const rows = await this.selectRows(
      "SELECT value FROM public.tiny_sync_state WHERE key = $1",
      ["fallback:next_page"]
    );
    const raw = rows?.[0]?.value;
    const num = Number(raw);
    if (!Number.isNaN(num) && num >= 1) return num;
    return 1;
  }

  private async setNextPage(n: number): Promise<void> {
    await this.connection.execute(
      `INSERT INTO public.tiny_sync_state(key, value, updated_at)
       VALUES($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      ["fallback:next_page", String(n)]
    );
  }

  /**
   * Normaliza o retorno de SELECT feito via .execute(...).
   * Lida com diferentes implementações:
   *  - array direto
   *  - objeto com .rows
   *  - objeto com .data (raro)
   */
  private async selectRows(sql: string, params: any[] = []): Promise<any[]> {
    const result: any = await this.connection.execute(sql, params);
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.rows)) return result.rows;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && typeof result === "object") {
      // tenta coletar itens iteráveis em propriedades comuns
      for (const k of Object.keys(result)) {
        const v = (result as any)[k];
        if (Array.isArray(v)) return v;
      }
    }
    return [];
  }

  // ===== SQL helpers =====

  private async upsertProductRowFromList(p: any) {
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

  private async upsertProductRowFromDetail(p: any) {
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
         code=COALESCE(EXCLUDED.code, public.tiny_products.code),
         name=COALESCE(EXCLUDED.name, public.tiny_products.name),
         sku=COALESCE(EXCLUDED.sku, public.tiny_products.sku),
         gtin=COALESCE(EXCLUDED.gtin, public.tiny_products.gtin),
         unit=COALESCE(EXCLUDED.unit, public.tiny_products.unit),
         price=COALESCE(EXCLUDED.price, public.tiny_products.price),
         promo_price=COALESCE(EXCLUDED.promo_price, public.tiny_products.promo_price),
         cost_price=COALESCE(EXCLUDED.cost_price, public.tiny_products.cost_price),
         avg_cost_price=COALESCE(EXCLUDED.avg_cost_price, public.tiny_products.avg_cost_price),
         location=COALESCE(EXCLUDED.location, public.tiny_products.location),
         status=COALESCE(EXCLUDED.status, public.tiny_products.status),
         created_at_tiny=COALESCE(EXCLUDED.created_at_tiny, public.tiny_products.created_at_tiny),
         updated_at=NOW();`,
      [
        p.id, p.codigo ?? null, p.nome ?? null, p.codigo ?? null, p.gtin ?? null, p.unidade ?? null,
        p.preco ?? null, p.preco_promocional ?? null, p.preco_custo ?? null, p.preco_custo_medio ?? null,
        p.localizacao ?? null, p.situacao ?? null, p.data_criacao ?? null
      ]
    );
  }

  private coerceTotalStock(p: any): number {
    const candidates = [p.estoque_atual, p.saldo, p.estoque, p.saldoEstoque, p.estoqueAtual];
    for (const v of candidates) {
      const n = Number(String(v ?? "").toString().replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  private async upsertDefaultStock(productId: number, quantity: number) {
    await this.connection.execute(
      `INSERT INTO public.tiny_product_stock (product_id, deposit_code, deposit_name, quantity, updated_at)
       VALUES ($1,'default','Sem depósitos',$2,NOW())
       ON CONFLICT (product_id, deposit_code) DO UPDATE SET
         deposit_name=EXCLUDED.deposit_name,
         quantity=EXCLUDED.quantity,
         updated_at=NOW();`,
      [productId, quantity || 0]
    );
  }

  // ===== util =====

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  private randomJitter() {
    return Math.floor(Math.random() * this.JITTER_MS);
  }
}
