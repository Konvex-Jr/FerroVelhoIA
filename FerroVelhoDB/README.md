# Integração Tiny ERP – Estoque (Node.js + PostgreSQL)

Guia passo a passo para qualquer membro do time rodar **localmente** a captura de **produtos** e **estoque** do Tiny e visualizar os dados no banco SQL.

---

## 0) Visão geral

* **Stack**: Node.js (ESM) + Prisma ORM + PostgreSQL
* **Fluxo**:

  1. `seed` → importa todos os **produtos** do Tiny
  2. `snapshot` → captura o **estoque** de todos os produtos e grava um **cursor** inicial
  3. `deltas` → atualiza apenas o que **mudou** desde o último cursor (<= 30 dias)
* **Tabelas**: `Product`, `DepositStock`, `SyncCursor`

---

## 1) Pré‑requisitos

* **Node.js** LTS (recomendado ≥ 18)
* **Git** (opcional, se clonar o repositório)
* **PostgreSQL** (local via Docker)
* **Token do Tiny** (gerar nas configurações do Tiny)
* (Opcional para deltas) Extensão do Tiny: **“API para estoque em tempo real”**

> **Windows PowerShell**: se tiver erro do tipo *“execução de scripts foi desabilitada”*, abra o PowerShell **como Administrador** e rode:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

---

## 2) Clonar e instalar dependências

```bash
# clonando o repositório
git clone <URL_DO_REPO>
cd tiny-estoque

# instalando dependências
npm install
```

---

## 3) Banco de dados 

### Docker 

```bash
docker run -d --name tinydb \
  -e POSTGRES_USER=tiny \
  -e POSTGRES_PASSWORD=tiny \
  -e POSTGRES_DB=tiny \
  -p 5432:5432 postgres:16
```
---

## 4) Configurar variáveis de ambiente

Crie um arquivo **.env** na raiz do projeto (copie o exemplo abaixo):

```env
DATABASE_URL="postgresql://tiny:tiny@localhost:5432/tiny?schema=public"
TINY_TOKEN="COLOQUE_SEU_TOKEN_AQUI"
# Espaço mínimo entre chamadas à API do Tiny (ms). Aumente se ver bloqueios.
TINY_MIN_TIME_MS=1500
```

> **Dica**: se a API bloquear por excesso de chamadas, aumente para `2000` ou `2500`.

---

## 5) Gerar as tabelas (Prisma)

```bash
npx prisma migrate dev
```

Isso cria as tabelas `Product`, `DepositStock` e `SyncCursor`.

---

## 6) Rodar os scripts (ordem recomendada)

### 6.1 Importar produtos (seed)

```bash
npm run seed
```

* Faz paginação automática (ex.: “Página 1/9 importada…”)
* Ao final, loga quantos produtos foram inseridos/atualizados

### 6.2 Tirar snapshot de estoque (com logs e ETA)

```bash
npm run snapshot
```

* Busca saldo total e por **depósito** de cada produto
* Exibe progresso a cada 5 itens e calcula **ETA**
* Ao finalizar, grava um **cursor** (agora − 10 min) para iniciar os **deltas**

### 6.3 Aplicar deltas (atualizações)

```bash
npm run deltas
```

* Atualiza apenas os produtos alterados desde o último cursor
* **Limite do Tiny**: a fila de atualizações cobre **até 30 dias**; o script garante um cursor válido

> **Rotina do dia a dia**: rodar apenas `npm run deltas` periodicamente (ex.: a cada 10–30 min). O `snapshot` só precisa ser rodado na **primeira** vez ou se resetar o banco.

---

## 7) Conferir dados no banco

### Via GUI (recomendado: DBeaver)

1. Baixe e abra o **DBeaver**
2. **Database → New Connection → PostgreSQL**
3. Host `localhost` · Port `5432` · Database `tiny` · User `tiny` · Password `tiny`
4. **Test Connection** → **Finish**
5. Clique em `tiny` → `Schemas` → `public` → `Tables` → botão direito **View Data**

---

## 8) Scripts disponíveis

```json
{
  "seed": "node scripts/seedProducts.js",        // importa produtos
  "snapshot": "node scripts/fetchStockSnapshot.js", // tira snapshot de estoque + grava cursor
  "deltas": "node scripts/syncDeltas.js",         // aplica atualizações desde o cursor
}
```

---

## 9) Perguntas frequentes (FAQ)

**• Preciso rodar o snapshot sempre?**
Não. Só na primeira execução (ou após resetar o banco). No dia a dia, rode só `deltas`.

**• O que é ETA que aparece no console?**
“Estimated Time of Arrival” → tempo **estimado** para terminar o snapshot, baseado na média por item.

**• Está aparecendo “API Bloqueada – Excedido o número de acessos a API”**
Aumente `TINY_MIN_TIME_MS` no `.env` (ex.: 2000 ou 2500) e rode novamente. O script possui **retry com backoff** e salva **offset** para retomar.

**• No `deltas` apareceu: “Somente podem ser listados os registros dos últimos 30 dias”**
Normal quando o cursor é muito antigo. O script já **trunca** o cursor para (agora − 29 dias). Rode de novo.

---

## 10) Estrutura do banco (resumo)

* **Product**: 1 linha por produto (saldo total, reservado, última alteração)
* **DepositStock**: saldos por **depósito** (e empresa, se houver)
* **SyncCursor**: chaves de progresso, ex.: `estoque_cursor` (deltas), `snapshot_offset` (retomada do snapshot)

---

## 11) Solução de problemas

* **Conexão recusada ao PostgreSQL**: verifique se o container `tinydb` está **UP** (`docker ps`) e se a porta `5432` está livre.
* **“relation "Product" does not exist”**: rode `npx prisma migrate dev` novamente.
* **Token inválido**: confirme `TINY_TOKEN` no `.env`.
* **Timeouts**: rede lenta → aumente `timeout` (já configurado nos clients) e `TINY_MIN_TIME_MS`.

---

## 12) Fluxo recomendado em produção

1. Rodar **snapshot** completo apenas **uma vez** (ou mensalmente como “full refresh”)
2. Rodar **deltas** a cada 10–30 minutos
3. Monitorar logs (sucesso/falhas/ETA) e métricas de **produtos com estoque crítico**
---

> Qualquer dúvida: abra um **issue** no repositório ou chame no canal interno.
