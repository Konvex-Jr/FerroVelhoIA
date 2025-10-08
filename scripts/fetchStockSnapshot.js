import "dotenv/config";
import { prisma } from "../src/db.js";
import { obterEstoqueProduto } from "../src/tinyClient.js";

async function getOffset() {
  const cur = await prisma.syncCursor.findUnique({ where: { key: "snapshot_offset" } });
  return Number(cur?.valueStr || 0);
}
async function setOffset(n) {
  await prisma.syncCursor.upsert({
    where: { key: "snapshot_offset" },
    update: { valueStr: String(n) },
    create: { key: "snapshot_offset", valueStr: String(n) }
  });
}

function fmt(n) {
  return n.toLocaleString("pt-BR");
}
function fmtDur(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h ? h + "h " : ""}${m ? m + "m " : ""}${ss}s`;
}
function fmtBR(d) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  const token = process.env.TINY_TOKEN;

  const ids = await prisma.product.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  if (!ids.length) {
    console.log("Nenhum produto encontrado. Rode primeiro: npm run seed");
    return;
  }

  const startOffset = await getOffset();
  const total = ids.length;

  console.log(`\n🟢 Iniciando snapshot de estoque`);
  console.log(`Produtos no banco: ${fmt(total)} | Offset inicial: ${fmt(startOffset)}`);
  console.log(`TINY_MIN_TIME_MS = ${process.env.TINY_MIN_TIME_MS || 1000} ms\n`);

  const t0 = Date.now();
  let ok = 0, fail = 0;

  for (let idx = startOffset; idx < total; idx++) {
    const { id } = ids[idx];

    const tItem0 = Date.now();
    const resp = await obterEstoqueProduto({ token, id });
    const r = resp?.retorno;

    if (r?.status === "OK" && r?.produto) {
      const p = r.produto;

      await prisma.product.update({
        where: { id },
        data: {
          totalBalance: p.saldo != null ? Number(p.saldo) : null,
          totalReserved: p.saldoReservado != null ? Number(p.saldoReservado) : null,
          lastTinyChange: p.data_alteracao
            ? new Date(p.data_alteracao.split("/").reverse().join("-"))
            : null
        }
      });

      if (Array.isArray(p.depositos)) {
        for (const { deposito } of p.depositos) {
          await prisma.depositStock.upsert({
            where: {
              productId_deposit: { productId: id, deposit: deposito.nome || "Padrão" }
            },
            update: {
              company: deposito.empresa ?? null,
              balance: deposito.saldo != null ? Number(deposito.saldo) : null
            },
            create: {
              productId: id,
              deposit: deposito.nome || "Padrão",
              company: deposito.empresa ?? null,
              balance: deposito.saldo != null ? Number(deposito.saldo) : null
            }
          });
        }
      }

      ok++;
    } else {
      console.error(`[${idx + 1}/${total}] Erro estoque id ${id}:`, r?.erros || r);
      fail++;
    }

    if ((idx + 1) % 5 === 0 || idx === startOffset) {
      const elapsed = Date.now() - t0;
      const processed = idx + 1 - startOffset;
      const avgPerItem = elapsed / processed;
      const remaining = total - (idx + 1);
      const eta = avgPerItem * remaining;
      const lastItemMs = Date.now() - tItem0;

      console.log(
        `[${idx + 1}/${total}] ok=${ok} fail=${fail} | último=${lastItemMs}ms | decorrido=${fmtDur(elapsed)} | ETA=${fmtDur(eta)}`
      );
    }

    if ((idx + 1) % 10 === 0) await setOffset(idx + 1);
  }

  // grava cursor para deltas: agora - 10min (buffer)
  const agora = new Date();
  const cursorInicial = new Date(agora.getTime() - 10 * 60 * 1000);
  await prisma.syncCursor.upsert({
    where: { key: "estoque_cursor" },
    update: { valueStr: fmtBR(cursorInicial) },
    create: { key: "estoque_cursor", valueStr: fmtBR(cursorInicial) }
  });

  await setOffset(0); // fim — zera offset

  const totalMs = Date.now() - t0;
  console.log(`\n✅ Snapshot concluído em ${fmtDur(totalMs)} | Sucesso: ${ok} | Falhas: ${fail}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
