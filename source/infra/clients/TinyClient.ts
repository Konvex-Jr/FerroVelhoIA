import axios from "axios";

type TinyResponse<T=any> = {
  retorno: {
    status: "OK" | "Erro";
    status_processamento?: number;
    erros?: { erro: string }[];
    pagina?: number;
    numero_paginas?: number;
    produtos?: { produto: any }[];
    produto?: any;
  } & T;
};

export default class TinyClient {
  private token: string;
  private baseUrl = "https://api.tiny.com.br/api2";

  constructor(token: string) {
    if (!token) throw new Error("TINY_API_TOKEN ausente");
    this.token = token;
  }

  private async post<R=any>(path: string, data: Record<string, any>): Promise<TinyResponse<R>> {
    const body = new URLSearchParams({ ...data, token: this.token, formato: "JSON" });
    const url = `${this.baseUrl}/${path}`;
    const res = await axios.post(url, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000
    });
    return res.data;
  }

  async searchProducts({ pesquisa = "", pagina = 1 }: { pesquisa?: string; pagina?: number; }) {
    // docs: https://tiny.com.br/api-docs/api2-produtos-pesquisar  (endpoint: produtos.pesquisa.php)
    return this.post("produtos.pesquisa.php", { pesquisa, pagina });
  }

  async getProduct(id: number | string) {
    // docs: https://tiny.com.br/api-docs/api2-produtos-obter  (endpoint: produto.obter.php)
    return this.post("produto.obter.php", { id });
  }

  async getProductStock(id: number | string) {
    // docs: https://tiny.com.br/api-docs/api2-produtos-estoque  (endpoint: produto.estoque.php)
    return this.post("produto.estoque.php", { id });
  }

  async listStockUpdates() {
    // docs: https://tiny.com.br/api-docs/api2-produtos-atualizacoes-estoque  (endpoint: produtos.atualizacoes.estoque.php)
    return this.post("produtos.atualizacoes.estoque.php", {});
  }

  async listChangedProducts() {
    // docs: https://tiny.com.br/api-docs/api2-produtos-alterados (endpoint: produtos.alterados.php)
    return this.post("produtos.alterados.php", {});
  }
}
