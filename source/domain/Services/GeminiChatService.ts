import { GoogleGenerativeAI } from "@google/generative-ai";
import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";
import RepositoryFactoryInterface from "../Interfaces/RepositoryFactoryInterface";
import TokenRepositoryInterface from "../Interfaces/TokenRepositoryInterface";
import Token from "../Entity/Token";
import ChatHistoryService from "./ChatHistoryService";
import Conversation from "../Entity/Conversation";
import Message from "../Entity/Message";

export default class GeminiChatService {
  private gemini: GoogleGenerativeAI;
  private tokenRepository: TokenRepositoryInterface;
  private chatHistoryService: ChatHistoryService;

  constructor(
      repositoryFactory: RepositoryFactoryInterface, 
      chatHistoryService: ChatHistoryService, 
      gemini?: GoogleGenerativeAI
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não definida");
    this.gemini = gemini || new GoogleGenerativeAI(apiKey);
    this.tokenRepository = repositoryFactory.createTokenRepository();
    this.chatHistoryService = chatHistoryService;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const modelInstance = this.gemini.getGenerativeModel({ model: ModelType.EMBEDDING_MODEL });
    const result = await modelInstance.embedContent(text);
    const embedding = result.embedding?.values;
    if (!embedding) throw new Error("Falha ao gerar embedding");
    const token = new Token(ModelType.EMBEDDING_MODEL, TokenType.EMBEDDING, 0);
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
      systemInstruction: systemPrompt
    });

    const chat = modelInstance.startChat({
      history: historyContents
    });

    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    
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