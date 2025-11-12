import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { TinyRepositoryInterface, LocalTinyProduct } from "../../domain/Interfaces/TinyRepositoryInterface";
import ChatHistoryService from "../../domain/Services/ChatHistoryService";
import GeminiChatService from "../../domain/Services/GeminiChatService";
import TinyClient from "../../infra/clients/TinyClient";

const MAX_PAGES_PER_RUN = Number(process.env.FALLBACK_MAX_PAGES_PER_RUN ?? "4");
const RATE_LIMIT_SLEEP_MS = Number(process.env.FALLBACK_RATE_LIMIT_SLEEP_MS ?? "60000");
const JITTER_MS = Number(process.env.FALLBACK_JITTER_MS ?? "400");
const PAGE_DELAY_MS = Number(process.env.FALLBACK_PAGE_DELAY_MS ?? "800");

export default class ImportAllProducts {
  private tinyRepository: TinyRepositoryInterface;
  private geminiChatService: GeminiChatService

  constructor(repositoryFactory: RepositoryFactoryInterface, private tiny: TinyClient) {
    this.tinyRepository = repositoryFactory.createTinyRepository();

    const chatHistoryService = new ChatHistoryService(repositoryFactory)

    this.geminiChatService = new GeminiChatService(
      repositoryFactory,
      chatHistoryService
    );
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
  private jitter() { return Math.floor(Math.random() * JITTER_MS); }

  async run(): Promise<void> {
    let page = await this.tinyRepository.getStateNumber("import:next_page", 1);
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
          await this.tinyRepository.setState("import:next_page", String(page));
          return;
        }
        console.warn(`[import] erro na página ${page}:`, msg);
        await this.tinyRepository.setState("import:next_page", String(page));
        return;
      }

      const r = resp?.retorno;
      if (!r || r.status !== "OK") {
        const msg = r?.erros?.map((x: any) => x?.erro).join("; ") || "Erro desconhecido";
        if (msg.includes("API Bloqueada")) {
          console.warn(`[import] bloqueado na página ${page}. Aguardando ${RATE_LIMIT_SLEEP_MS}ms…`);
          await this.sleep(RATE_LIMIT_SLEEP_MS + this.jitter());
          await this.tinyRepository.setState("import:next_page", String(page + 1));
          return;
        }
        console.warn(`[import] falha na página ${page}: ${msg}`);
        await this.tinyRepository.setState("import:next_page", String(page + 1));
        return;
      }

      totalPages = Number(r.numero_paginas || page);
      const produtos = r.produtos ?? [];
      if (!Array.isArray(produtos) || produtos.length === 0) {
        await this.tinyRepository.setState("import:next_page", "1");
        return;
      }

      for (const item of produtos) {
        const p = item?.produto;
        if (!p?.id) continue;

        let productDetail = p;
        let totalQuantity = 0;
        try {
          const detail = await this.tiny.getProduct(p.id);
          const prod = detail?.retorno?.produto;
          if (prod) {
            productDetail = prod;
            totalQuantity = this.coerceTotalStock(prod);
          }
        } catch (e) {
          totalQuantity = this.coerceTotalStock(p);
        }

        let nameVector: number[] = [];
        try {
          if (productDetail.nome) {
            nameVector = await this.geminiChatService.generateEmbedding(productDetail.nome);
          }
        } catch (e: any) {
          console.warn(`[import] Falha ao gerar embedding para ${productDetail.id}: ${e.message}`);
        }

        await this.upsertProductRow(productDetail, totalQuantity, nameVector);
      }

      processed++;
      page++;
      if (page > totalPages) {
        await this.tinyRepository.setState("import:next_page", "1");
        console.log(`[import] catálogo completo varrido (${totalPages} páginas).`);
        return;
      } else {
        await this.tinyRepository.setState("import:next_page", String(page));
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

  private async upsertProductRow(p: any, quantity: number, nameVector: number[]) {
    const productData: LocalTinyProduct = {
      id: p.id,
      code: p.codigo,
      name: p.nome,
      sku: p.codigo,
      gtin: p.gtin,
      unit: p.unidade,
      price: p.preco,
      promo_price: p.preco_promocional,
      cost_price: p.preco_custo,
      avg_cost_price: p.preco_custo_medio,
      location: p.localizacao,
      status: p.situacao,
      created_at_tiny: p.data_criacao,
      quantity: quantity,
      name_vector: nameVector
    };
    await this.tinyRepository.saveProductWithVector(productData);
  }
}
