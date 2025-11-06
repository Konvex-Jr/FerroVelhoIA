import axios from "axios";

export default class TinyClient {
  constructor(private token: string) {}

  private async post(endpoint: string, params: Record<string, any>) {
    const body = new URLSearchParams({
      token: this.token,
      formato: "json",
      ...Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined && v !== null))
    });
    const url = `https://api.tiny.com.br/api2/${endpoint}`;
    const resp = await axios.post(url, body);
    return resp.data;
  }

  // lista por pagina
  searchProducts({ pesquisa = "", pagina = 1 }: { pesquisa?: string; pagina?: number; }) {
    return this.post("produtos.pesquisa.php", { pesquisa, pagina: String(pagina) });
  }

  // detalhe do produto
  getProduct(id: number | string) {
    return this.post("produto.obter.php", { id });
  }

  // estoque de 1 produto (requer extensão/permissão de estoque)
  getProductStock(id: number | string) {
    return this.post("produto.estoque.php", { id });
  }

  // delta de cadastro (se disponível na sua conta)
  listChangedProducts(params: { dataAlteracao?: string; pagina?: number } = {}) {
    // ajuste p/ endpoint suportado na sua conta (ex.: lista.atualizacoes.produtos)
    return this.post("lista.atualizacoes.produtos", params);
  }

  // delta de estoque (o que vamos usar no cron)
  listStockUpdates(params: { dataAlteracao: string; pagina?: number }) {
    return this.post("lista.atualizacoes.estoque", {
      dataAlteracao: params.dataAlteracao,
      pagina: String(params.pagina ?? 1),
    });
  }
}
