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
  private genAI: GoogleGenerativeAI;
  private tokenRepository: TokenRepositoryInterface;
  private chatHistoryService: ChatHistoryService;

  constructor(repositoryFactory: RepositoryFactoryInterface, chatHistoryService: ChatHistoryService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.tokenRepository = repositoryFactory.createTokenRepository();
    this.chatHistoryService = chatHistoryService;
  }

  async chatWithConversation(
    conversation: Conversation,
    model: ModelType,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const previousMessages: Message[] = await this.chatHistoryService.getChatHistory(conversation.id);

    const modelInstance = this.genAI.getGenerativeModel({ model });

    const response = await modelInstance.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        ...previousMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userPrompt }] },
      ],
    });

    const reply = response.response.text();

    await this.chatHistoryService.addMessage(conversation.id, "user", userPrompt);
    await this.chatHistoryService.addMessage(conversation.id, "assistant", reply);

    const token = new Token(model, TokenType.OUTPUT, 0);
    await this.tokenRepository.create(token);

    return reply;
  }
}
