import { GoogleGenerativeAI, Tool, SchemaType } from "@google/generative-ai";
import TinyClientService from "../../infra/clients/TinyClient";
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
        description: "Busca produtos no TinyERP. IMPORTANTE: A busca é exata, então nem sempre será totalmente igual ao que o cliente pedir. DICA: Remova preposições (de, para, com) e palavras muito específicas na primeira tentativa, ou faça múltiplas chamadas tentando variações. REGRA CRÍTICA DE FUNCIONAMENTO: Se a busca exata falhar, esta função DEVE buscar automaticamente por termos parciais. O modelo NÃO deve pedir permissão para buscar termos genéricos, deve apenas executar.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchTerm: {
              type: SchemaType.STRING,
              description: "O nome, SKU ou termo para pesquisar o produto."
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
  private tinyClient: TinyClientService;

  constructor(
      repositoryFactory: RepositoryFactoryInterface, 
      chatHistoryService: ChatHistoryService, 
      tinyClient: TinyClientService,
      gemini?: GoogleGenerativeAI
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não definida");
    this.gemini = gemini || new GoogleGenerativeAI(apiKey);
    this.tokenRepository = repositoryFactory.createTokenRepository();
    this.chatHistoryService = chatHistoryService;
    this.tinyClient = tinyClient;
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
    }));

    const modelInstance = this.gemini.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      tools: tools
    });

    const chat = modelInstance.startChat({
      history: historyContents
    });

    let result = await chat.sendMessage(userPrompt);
    let response = result.response;
    let functionCalls = response.functionCalls();

    let maxRecursion = 3; 

    while (functionCalls && functionCalls.length > 0 && maxRecursion > 0) {
      maxRecursion--;
      
      const call = functionCalls[0];
      let functionResponse: any = null;

      console.log(`[Gemini] Chamando ferramenta: ${call.name} com args:`, call.args);

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
          functionResponse = { erro: "Função não implementada ou sem retorno." };
        }

      } catch (e: any) {
        console.error(`[Gemini] Erro ao executar ${call.name}:`, e.message);
        functionResponse = { erro: `Falha ao executar a função: ${e.message}` };
      }


      result = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: functionResponse
          }
        }
      ]);

      response = result.response;
      functionCalls = response.functionCalls();
    }

    const reply = response.text();

    await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
    await this.chatHistoryService.addMessage(conversation.id, "model", reply);
    
    this.saveTokenUsage(response.usageMetadata, model);

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