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

  constructor(repositoryFactory: RepositoryFactoryInterface, chatHistoryService: ChatHistoryService, gemini?: GoogleGenerativeAI) {
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

    const { totalTokens } = await modelInstance.countTokens(text);
    const token = new Token(
      ModelType.EMBEDDING_MODEL,
      TokenType.EMBEDDING,
      totalTokens || 0
    );
    await this.tokenRepository.create(token);

    return embedding;
  }

  async chatWithConversation(conversation: Conversation, model: ModelType, systemPrompt: string, userPrompt: string): Promise<string> {
    const previousMessages: Message[] = await this.chatHistoryService.getChatHistory(conversation.id);

    const modelInstance = this.gemini.getGenerativeModel({
      model,
      systemInstruction: systemPrompt
    });

    const contents = [
      ...previousMessages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: userPrompt }] }
    ];

    const response = await modelInstance.generateContent({ contents });
    const reply = response.response.text();

    await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
    await this.chatHistoryService.addMessage(conversation.id, "model", reply);

    const usage = response.response.usageMetadata;
    if (usage) {
      const inputToken = new Token(model, TokenType.INPUT, usage.promptTokenCount);
      await this.tokenRepository.create(inputToken);

      const outputToken = new Token(model, TokenType.OUTPUT, usage.candidatesTokenCount);
      await this.tokenRepository.create(outputToken);
    } else {
      const fallbackToken = new Token(model, TokenType.OUTPUT, 0);
      await this.tokenRepository.create(fallbackToken);
    }

    return reply;
  }
}