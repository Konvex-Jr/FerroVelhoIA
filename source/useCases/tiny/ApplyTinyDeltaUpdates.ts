import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { LocalTinyProduct, TinyRepositoryInterface } from "../../domain/Interfaces/TinyRepositoryInterface";
import GeminiChatService from "../../domain/Services/GeminiChatService";
import TinyClient from "../../infra/clients/TinyClient";
import ChatHistoryService from "../../domain/Services/ChatHistoryService";

function toNumber(val: any): number {
  if (val == null) return 0;
  const s = String(val).replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default class ApplyTinyDeltaUpdates {
  private tinyRepository: TinyRepositoryInterface;
  private geminiChatService: GeminiChatService;

  constructor(
    repositoryFactory: RepositoryFactoryInterface,
    private tiny: TinyClient
  ) {
    this.tinyRepository = repositoryFactory.createTinyRepository();

    const chatHistoryService = new ChatHistoryService(repositoryFactory)

    this.geminiChatService = new GeminiChatService(
      repositoryFactory,
      chatHistoryService
    );
  }

  private nowBR(): string {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async run(): Promise<void> {
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

    const since = (await this.tinyRepository.getLastSync("incremental:last_sync_at")) || "01/01/2000 00:00:00";

    let page = 1;

    while (true) {
      let stockUpdates: any;
      try { stockUpdates = await this.tiny.listStockUpdates({ dataAlteracao: since, pagina: page }); }
      catch (e: any) { break; }
      const r = stockUpdates?.retorno;
      if (!r || r.status !== "OK") break;

      const items = r.produtos ?? [];
      for (const it of items) {
        const pid = it?.produto?.id || it?.id;
        if (!pid) continue;
        try {
          const detail = await this.tiny.getProductStock(pid);
          const estoques = detail?.retorno?.estoques || detail?.retorno?.produto?.depositos || [];
          await this.updateProductQuantity(pid, estoques);
        } catch (e: any) {
          console.warn(`Falha ao obter estoque do produto ${pid}:`, e?.message ?? e);
        }
      }
      const total = Number(r.numero_paginas || 1);
      if (page >= total) break;
      page++;
    }

    await this.tinyRepository.setLastSync("incremental:last_sync_at", this.nowBR());
    console.log("Deltas aplicados.");
  }

  private async upsertProductRow(p: any) {
    let nameVector: number[] = [];
    try {
      if (p.nome) {
        nameVector = await this.geminiChatService.generateEmbedding(p.nome);
      }
    } catch (e: any) {
      console.warn(`[delta] Falha ao gerar embedding para ${p.id}: ${e.message}`);
    }
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
      quantity: 0, 
      name_vector: nameVector
    };

    await this.tinyRepository.saveProductWithVector(productData);
  }

  private async updateProductQuantity(productId: number | string, estoques: any[]) {
    const list = Array.isArray(estoques) ? estoques : [];
    const total = list.reduce((acc, e) => {
      const saldo = e?.deposito?.saldo ?? e?.saldo ?? e?.quantidade ?? 0;
      return acc + toNumber(saldo);
    }, 0);

    const first = list[0]?.deposito || list[0] || {};
    const depCode = String(first.codigo_deposito ?? first.id ?? first.codigo ?? "default");

    await this.tinyRepository.updateStock(productId, total, depCode);
  }
}