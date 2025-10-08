import "dotenv/config";
import { prisma } from "../src/db.js";
import { pesquisarProdutos } from "../src/tinyClient.js";

async function main() {
  const token = process.env.TINY_TOKEN;
  let pagina = 1;
  let totalInseridos = 0;
  let totalPaginas = Infinity;

  while (pagina <= totalPaginas) {
    const resp = await pesquisarProdutos({ token, pesquisa: "", pagina });
    const r = resp?.retorno;

    if (r?.status !== "OK") {
      console.error("Erro Tiny:", r?.erros ?? resp);
      break;
    }

    const pags = Number(r?.paginacao?.paginas || 0);
    if (Number.isFinite(pags) && pags > 0) totalPaginas = pags;

    const produtos = r?.produtos ?? [];
    if (produtos.length === 0) break;

    for (const { produto } of produtos) {
      await prisma.product.upsert({
        where: { id: Number(produto.id) },
        update: {
          name: produto.nome ?? null,
          code: produto.codigo ?? null,
          unit: produto.unidade ?? null
        },
        create: {
          id: Number(produto.id),
          name: produto.nome ?? null,
          code: produto.codigo ?? null,
          unit: produto.unidade ?? null
        }
      });
      totalInseridos++;
    }

    console.log(`Página ${pagina}/${totalPaginas} importada (${produtos.length} itens).`);
    pagina++;
  }

  console.log(`Concluído. Produtos inseridos/atualizados: ${totalInseridos}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
