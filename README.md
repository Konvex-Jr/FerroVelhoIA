🤖 Ferro Velho IA - Sistema de Atendimento Inteligente para Autopeças
Solução de Inteligência Artificial integrada ao WhatsApp (Evolution API) e ERP Tiny, utilizando busca semântica (RAG) para automatizar a venda de peças, identificação de inventário e atendimento ao cliente.

📋 Índice
Visão Geral

Características Principais

Arquitetura

Tecnologias Utilizadas

Estrutura do Projeto

Integração com ERP Tiny

Configuração e Instalação

Treinamento da IA e Sincronização

🎯 Visão Geral
O Ferro Velho IA é um sistema projetado para modernizar a experiência de compra no Ferro Velho do Compressor. Ele automatiza:

✅ Atendimento via WhatsApp para consulta de peças.

✅ Identificação de disponibilidade no estoque em tempo real.

✅ Busca semântica para encontrar peças por descrição (ex: "lanterna traseira" vs "farol de trás").

✅ Sincronização automática com o ERP Tiny.

🚀 Características Principais
Inteligência e RAG (Busca Semântica)
RagController: Consulta bases de conhecimento vetoriais para retornar respostas precisas sobre compatibilidade e estoque.

Tratamento de Mensagens: Extração de textos, imagens, documentos e botões recebidos via Evolution API.

Persistência de Contexto: Gerenciamento de conversas através do remoteJid para manter o histórico do cliente.

Filtros e Especialização
Filtro de Categoria: Separação automática entre peças de motor, lataria, elétrica e suspensão.

Lógica de Fallback: Ajuste automático quando a IA não identifica de imediato a peça ou o modelo do veículo.

Integração com ERP
Tiny ERP: Sincronização de toda a base de produtos e aplicação de deltas de estoque.

🏗️ Arquitetura
Snippet de código

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
│  ┌─────────────┐      ┌──────────────┐ │
│  │ UseCases    │      │  OpenAI API  │ │
│  │ (Lógica)    │─────▶│   (GPT-4)    │ │
│  └─────────────┘      └──────────────┘ │
│          │                   │          │
│          ▼                   ▼          │
│  ┌─────────────┐      ┌──────────────┐ │
│  │  Tiny ERP   │      │  PostgreSQL  │ │
│  │ (Produtos)  │      │  (Prisma)    │ │
│  └─────────────┘      └──────────────┘ │
└─────────────────────────────────────────┘
🛠️ Tecnologias Utilizadas
Linguagem: JavaScript / Node.js

API de Comunicação: Evolution API (WhatsApp)

IA/ML: OpenAI (GPT-4) e Embeddings para busca por similaridade

Banco de Dados: PostgreSQL com Prisma ORM (Gestão de inventário e logs)

Ambiente: Linux Fedora / Docker

📂 Estrutura do Projeto
source/
├── domain/                 # Regras de negócio puras (Independente de infra)
│   ├── Entity/             # Objetos de negócio (Peça, Contato, etc)
│   ├── Enums/              # Constantes e Tipos
│   ├── Interfaces/         # Contratos para repositórios e serviços
│   └── Services/           # Lógica de domínio especializada
├── infra/                  # Implementações técnicas
│   ├── clients/            # Integração com Tiny API e Evolution API
│   ├── controller/         # Adaptadores de entrada (Express/Routes)
│   ├── database/           # Configuração de conexão e Prisma
│   ├── http/               # Instância do servidor web
│   ├── migrations/         # Esquema do banco de dados
│   └── repository/         # Acesso real aos dados (SQL)
├── scripts/                # Automação e Jobs em lote
│   ├── import-embeddings-run.ts
│   ├── tiny-apply-deltas.ts
│   └── tiny-import-all.ts
├── useCases/               # Orquestração do fluxo (AskQuestion, TinySync)
└── main.ts                 # Ponto de entrada da aplicação
📦 Integração com ERP Tiny
O sistema utiliza scripts especializados para garantir que o chatbot nunca ofereça peças sem estoque:

Importação Massiva: tiny-import-all.ts sincroniza a base completa de produtos do Tiny de uma única vez.

Atualização Incremental: tiny-apply-deltas.ts aplica apenas as mudanças de estoque recentes para manter os dados atualizados sem sobrecarregar a API.

🎓 Treinamento da IA e Sincronização
Gerar Base Vetorial
Para que a busca semântica funcione, é necessário processar as descrições das peças:

Bash

npm run import:embeddings
Este script executa o import-embeddings-run.ts, transformando os nomes e detalhes das peças em vetores matemáticos salvos no PostgreSQL.

🔧 Configuração e Instalação
Produção (VPS Contabo)
O deploy é realizado via EasyPanel no servidor VPS:

Acesse: http://185.252.233.252:3000

Realize o login na plataforma

Configure as Variáveis de Ambiente (.env) no painel

Clique em Deploy
