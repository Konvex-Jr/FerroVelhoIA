import { GoogleGenerativeAI, Tool, SchemaType } from "@google/generative-ai";
import TinyClientService from "../../infra/clients/TinyClient"; // ADICIONADO (Precisamos importar)
import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";
import ChatHistoryService from "./ChatHistoryService";
import Conversation from "../Entity/Conversation";
import Message from "../Entity/Message";

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_products_by_name",
        description: "Busca produtos no sistema TinyERP com base em um nome, SKU ou termo de pesquisa. Retorna uma lista de produtos.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchTerm: {
              type: SchemaType.STRING,
              description: "O nome, SKU ou termo para pesquisar o produto (ex: 'Parafuso', 'Camisa Azul')"
            }
          },
          required: ["searchTerm"]
        }
      },
      {
        name: "get_product_stock",
        description: "Obtém o estoque de um produto específico usando o ID único do produto.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            productId: {
              type: SchemaType.STRING,
              description: "O ID numérico do produto no sistema Tiny."
            }
          },
          required: ["productId"]
        }
      }
    ]
  }
];

export default class GeminiChatService {
  private gemini: GoogleGenerativeAI;
  private tokenRepository: TokenRepositoryInterface;
  private chatHistoryService: ChatHistoryService;
  private tinyClient: TinyClientService; // ADICIONADO: A propriedade da classe

  constructor(
      repositoryFactory: RepositoryFactoryInterface, 
      chatHistoryService: ChatHistoryService, 
      tinyClient: TinyClientService, // ADICIONADO: O parâmetro
      gemini?: GoogleGenerativeAI
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não definida");
    this.gemini = gemini || new GoogleGenerativeAI(apiKey);
    this.tokenRepository = repositoryFactory.createTokenRepository();
    this.chatHistoryService = chatHistoryService;
    this.tinyClient = tinyClient; // ADICIONADO: A atribuição
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const modelInstance = this.gemini.getGenerativeModel({ model: ModelType.EMBEDDING_MODEL });
    const result = await modelInstance.embedContent(text);
    const embedding = result.embedding?.values;

    if (!embedding) throw new Error("Falha ao gerar embedding");

    const token = new Token(
      ModelType.EMBEDDING_MODEL,
      TokenType.EMBEDDING,
      0
    );
    await this.tokenRepository.create(token);

    return embedding;
  }

  async chatWithConversation(conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string): Promise<string> {
    const previousMessages: Message[] = await this.chatHistoryService.getChatHistory(conversation.id);
    const historyContents = previousMessages.map(m => ({
      role: m.role as ("user" | "model"),
      parts: [{ text: m.content }]
    }))

    const modelInstance = this.gemini.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      tools: tools
    });

    const chat = modelInstance.startChat({
      history: historyContents
    });

    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      const reply = response.text();
      await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
      await this.chatHistoryService.addMessage(conversation.id, "model", reply);
      this.saveTokenUsage(response.usageMetadata, model);
      return reply;
    }

    const call = functionCalls[0];
    let functionResponse: any = null;

    try {
      if (call.name === 'search_products_by_name') {
        const { searchTerm } = call.args as { searchTerm: string };
        functionResponse = await this.tinyClient.searchProducts({ pesquisa: searchTerm });
      }
      else if (call.name === 'get_product_stock') {
        const { productId } = call.args as { productId: string };
        functionResponse = await this.tinyClient.getProductStock(productId);
      }

      if (functionResponse === null) {
        functionResponse = { erro: "Função não implementada no lado do servidor." };
      }

    } catch (e: any) {
      console.error(`[TinyClient] Erro ao executar ${call.name}:`, e.message);
      functionResponse = { erro: `Falha ao executar a função: ${e.message}` };
    }

    const resultAfterFunctionCall = await chat.sendMessage([
      {
        functionResponse: {
          name: call.name,
          response: functionResponse // Envia o JSON/resultado do Tiny
        }
      }
    ]);

    const finalResponse = resultAfterFunctionCall.response;
    const reply = finalResponse.text();

    await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
    await this.chatHistoryService.addMessage(conversation.id, "model", reply);
    this.saveTokenUsage(finalResponse.usageMetadata, model);

    return reply;
  }
  
  private async saveTokenUsage(usageMetadata: any, model: ModelType) {
    if (usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = usageMetadata;
      const inputToken = new Token(model, TokenType.INPUT, promptTokenCount);
      await this.tokenRepository.create(inputToken);
      const outputToken = new Token(model, TokenType.OUTPUT, candidatesTokenCount);
      await this.tokenRepository.create(outputToken);
    } else {
      const fallbackToken = new Token(model, TokenType.OUTPUT, 0);
      await this.tokenRepository.create(fallbackToken);
    }
  }
}