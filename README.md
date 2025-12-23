# 🤖 Ferro Velho IA  
### Sistema de Atendimento Inteligente para Autopeças

Solução de **Inteligência Artificial** integrada ao **WhatsApp (Evolution API)** e ao **ERP Tiny**, utilizando **busca semântica (RAG)** para automatizar a venda de peças, identificação de inventário e atendimento ao cliente.

---

## 📋 Índice
- [🎯 Visão Geral](#-visão-geral)
- [🚀 Características Principais](#-características-principais)
- [🏗️ Arquitetura](#️-arquitetura)
- [🛠️ Tecnologias Utilizadas](#️-tecnologias-utilizadas)
- [📂 Estrutura do Projeto](#-estrutura-do-projeto)
- [📦 Integração com ERP Tiny](#-integração-com-erp-tiny)
- [🎓 Treinamento da IA e Sincronização](#-treinamento-da-ia-e-sincronização)
- [🔧 Configuração e Instalação](#-configuração-e-instalação)

---

## 🎯 Visão Geral

O **Ferro Velho IA** foi desenvolvido para modernizar a experiência de compra no **Ferro Velho do Compressor**, automatizando:

- ✅ Atendimento via **WhatsApp** para consulta de peças  
- ✅ Identificação de **disponibilidade em estoque em tempo real**  
- ✅ **Busca semântica** por descrição de peças  
  > Ex: *“lanterna traseira”* ≈ *“farol de trás”*  
- ✅ Sincronização automática com o **ERP Tiny**

---

## 🚀 Características Principais

### 🧠 Inteligência Artificial & RAG (Busca Semântica)
- **RagController**  
  Consulta bases vetoriais para retornar respostas precisas sobre:
  - Compatibilidade
  - Disponibilidade
  - Descrição de peças  

- **Persistência de Contexto**  
  Gerenciamento de conversas através do `remoteJid`, mantendo o histórico do cliente.

---

### 🧩 Filtros e Especialização
- **Lógica de Fallback Inteligente**
  - Reinterpretação da pergunta
  - Solicitação de mais detalhes quando o modelo ou peça não são identificados

---

### 🔗 Integração com ERP
- **ERP Tiny**
  - Sincronização completa da base de produtos
  - Aplicação de *deltas* de estoque para manter dados sempre atualizados

---

## 🏗️ Arquitetura

```text
┌─────────────┐
│  WhatsApp   │
│  (Cliente)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Evolution API   │
│   (Webhook)     │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          Ferro Velho IA (Node.js)       │
│                                         │
│  ┌─────────────┐      ┌──────────────┐  │
│  │ UseCases    │─────▶│  Gemeni API |  │
│  │ (Lógica)    │      │   (GPT-4)    │  │
│  └─────────────┘      └──────────────┘  │
│          │                   │          │
│          ▼                   ▼          │
│  ┌─────────────┐      ┌──────────────┐ │
│  │  Tiny ERP   │      │  PostgreSQL  │ │
│  │ (Produtos)  │      │  (Prisma)    │ │
│  └─────────────┘      └──────────────┘ │
└─────────────────────────────────────────┘
````

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** JavaScript / Node.js  
- **Comunicação:** Evolution API (WhatsApp)  
- **IA / ML:**  
  - Gemini
  - Embeddings para busca por similaridade (RAG)  
- **Banco de Dados:** PostgreSQL + Prisma ORM
- 
---

## 📂 Estrutura do Projeto

```text
source/
├── domain/                 # Regras de negócio puras (independente de infraestrutura)
│   ├── Entity/             # Entidades (Peça, Contato, etc)
│   ├── Enums/              # Constantes e tipos
│   ├── Interfaces/         # Contratos
│   └── Services/           # Lógica de domínio especializada
│
├── infra/                  # Implementações técnicas
│   ├── clients/            # Integração com Tiny API e Evolution API
│   ├── controller/         # Controllers / Webhooks
│   ├── database/           # Prisma e conexões
│   ├── http/               # Servidor HTTP
│   ├── migrations/         # Migrations do banco
│   └── repository/         # Repositórios SQL
│
├── scripts/                # Jobs e automações
│   ├── import-embeddings-run.ts
│   ├── tiny-apply-deltas.ts
│   └── tiny-import-all.ts
│
├── useCases/               # Orquestração dos fluxos
└── main.ts                 # Entry point da aplicação

```

---

## 📦 Integração com ERP Tiny

O sistema utiliza scripts especializados para garantir que o chatbot **nunca ofereça peças sem estoque**, mantendo os dados sempre consistentes com o ERP.

### 🔄 Importação Massiva
- **Script:** `tiny-import-all.ts`
- Sincroniza a base completa de produtos do Tiny de uma única vez.
- Utilizado no setup inicial ou em reprocessamentos completos.

### ⚡ Atualização Incremental
- **Script:** `tiny-apply-deltas.ts`
- Aplica apenas as mudanças recentes de estoque.
- Mantém os dados atualizados sem sobrecarregar a API do Tiny.

---

## 🎓 Treinamento da IA e Sincronização

### 🔢 Geração da Base Vetorial

Para que a **busca semântica** funcione corretamente, é necessário processar as descrições das peças:

```bash
npm run import:embeddings
```

---
## 🔧 Configuração e Instalação
### 🚀 Produção (VPS Contabo)

O deploy é realizado via EasyPanel no servidor VPS:

Acesse:

http://185.252.233.252:3000


Realize o login na plataforma

Configure as variáveis de ambiente (.env) no painel

Clique em Deploy

