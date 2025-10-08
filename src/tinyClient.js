import axios from "axios";
import Bottleneck from "bottleneck";

const limiter = new Bottleneck({
  // Mais conservador para evitar bloqueio (ajuste via .env)
  minTime: Number(process.env.TINY_MIN_TIME_MS || 1000),
  maxConcurrent: 1
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const postForm = (url, data) =>
  limiter.schedule(() =>
    axios.post(url, new URLSearchParams(data).toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000
    })
  );

export async function pesquisarProdutos({ token, pesquisa = "", pagina = 1 }) {
  const url = "https://api.tiny.com.br/api2/produtos.pesquisa.php";
  const { data } = await postForm(url, { token, pesquisa, formato: "JSON", pagina });
  return data;
}

// Retry/backoff apenas para endpoints sensíveis a rate limit
async function postFormWithRetry(url, form) {
  let attempt = 0;
  let waitMs = 5000; // 5s inicial
  while (true) {
    const { data } = await postForm(url, form);
    const r = data?.retorno;
    const bloqueada = Array.isArray(r?.erros) && r.erros.some(e => String(e.erro).includes("API Bloqueada"));
    const ok = r?.status === "OK";
    if (ok) return data;
    if (bloqueada) {
      attempt++;
      console.warn(`Rate limit Tiny (tentativa ${attempt}). Aguardando ${Math.round(waitMs/1000)}s...`);
      await sleep(waitMs);
      waitMs = Math.min(waitMs * 2, 5 * 60 * 1000); // máx 5 minutos
      continue;
    }
    return data; // outros erros: retorna p/ o chamador tratar/logar
  }
}

export async function obterEstoqueProduto({ token, id }) {
  const url = "https://api.tiny.com.br/api2/produto.obter.estoque.php";
  return postFormWithRetry(url, { token, id: String(id), formato: "JSON" });
}

export async function listarAtualizacoesEstoque({ token, dataAlteracao, pagina = 1 }) {
  const url = "https://api.tiny.com.br/api2/lista.atualizacoes.estoque";
  const { data } = await postForm(url, { token, dataAlteracao, formato: "JSON", pagina });
  return data;
}
