import "dotenv/config";
import { prisma } from "../src/db.js";
import { listarAtualizacoesEstoque, obterEstoqueProduto } from "../src/tinyClient.js";

function fmtBR(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function parseBR(s) {
  const [data, hora = "00:00:00"] = String(s).split(" ");
  const [d, m, y] = data.split("/").map(Number);
  const [H, Mi, S] = hora.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, H || 0, Mi || 0, S || 0);
}

const MAX_AGE_DAYS = 29; // margem dentro dos 30 dias do Tiny

async function main() {
  const token = process.env.TINY_TOKEN;

  // Lê cursor salvo
  let cursorStr = (await prisma.syncCursor.findUnique({ where: { key: "estoque_cursor" } }))?.valueStr;

  if (!cursorStr) {
    // sem snapshot prévio: comece de agora - 1 dia
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
    cursorStr = fmtBR(start);
  } else {
    // se muito antigo (>30 dias), trunque para agora - 29 dias
    const cur = parseBR(cursorStr);
    const limit = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    if (cur < limit) cursorStr = fmtBR(limit);
  }

  let pagina = 1;
  let maiorData = cursorStr;
  let total = 0;

  while (true) {
    const resp = await listarAtualizacoesEstoque({ token, dataAlteracao: cursorStr, pagina });
    const r = resp?.retorno;
    if (r?.status !== "OK") {
      console.error("Erro lista.atualizacoes.estoque:", r?.erros || r);
      break;
    }

    const itens = r?.produtos ?? [];
    if (itens.length === 0) break;

    for (const { produto } of itens) {
      const r2 = await obterEstoqueProduto({ token, id: produto.id });
      if (r2?.retorno?.status === "OK" && r2?.retorno?.produto) {
        const p = r2.retorno.produto;

        await prisma.product.upsert({
          where: { id: Number(produto.id) },
          create: { id: Number(produto.id), name: p.nome ?? null, code: p.codigo ?? null, unit: p.unidade ?? null },
          update: { name: p.nome ?? null, code: p.codigo ?? null, unit: p.unidade ?? null }
        });

        await prisma.product.update({
          where: { id: Number(produto.id) },
          data: {
            totalBalance: p.saldo != null ? Number(p.saldo) : null,
            totalReserved: p.saldoReservado != null ? Number(p.saldoReservado) : null,
            lastTinyChange: produto.data_alteracao
              ? new Date(produto.data_alteracao.split("/").reverse().join("-"))
              : null
          }
        });

        if (Array.isArray(p.depositos)) {
          for (const { deposito } of p.depositos) {
            await prisma.depositStock.upsert({
              where: {
                productId_deposit: { productId: Number(produto.id), deposit: deposito.nome || "Padrão" }
              },
              update: {
                company: deposito.empresa ?? null,
                balance: deposito.saldo != null ? Number(deposito.saldo) : null
              },
              create: {
                productId: Number(produto.id),
                deposit: deposito.nome || "Padrão",
                company: deposito.empresa ?? null,
                balance: deposito.saldo != null ? Number(deposito.saldo) : null
              }
            });
          }
        }

        total++;
        if (produto.data_alteracao && produto.data_alteracao > maiorData) {
          maiorData = produto.data_alteracao; // string dd/mm/aaaa hh:mm:ss
        }
      }
    }

    pagina++;
  }

  if (maiorData && maiorData !== cursorStr) {
    await prisma.syncCursor.upsert({
      where: { key: "estoque_cursor" },
      update: { valueStr: maiorData },
      create: { key: "estoque_cursor", valueStr: maiorData }
    });
  }

  console.log(`Deltas aplicados: ${total}. Cursor agora em: ${maiorData}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
