import Http from "../Http";
import sendMessage from "../../../domain/Services/sendMessageService";
import RagController from "../../controller/RagController";

const LOG_PREFIX = "[EvolutionAPI:webhook]";
const FALLBACK_REPLY = "Desculpe, não consegui entender sua mensagem.";

export default class EvolutionRoutes {
  constructor(
    readonly http: Http,
    private readonly ragController: RagController
  ) { }

  init(): void {
    const paths = [
      "/webhook/evolution",
      "/ask/contacts-update", // Rotas extras caso precise no futuro
      "/ask/messages-upsert"
    ];

    for (const path of paths) {
      this.http.route("post", path, false, async (params: any, body: any) => {
        return this.handleWebhook(path, params, body);
      });
    }
  }

  private async handleWebhook(path: string, params: any, body: any) {
    // 1. Verificação de Evento
    const event = body?.event || body?.type || params?.event;
    if (event && event !== "messages.upsert") {
      // Ignora eventos que não sejam novas mensagens (ex: update de status)
      return { status: "ignored_event" };
    }

    // 2. Extração de Dados usando Helpers Robustos
    const messageContainer = extractMessageContainer(body);
    const messageText = extractMessageText(messageContainer, body);
    const remoteJid = extractRemoteJid(body);
    const fromMe = Boolean(body?.data?.key?.fromMe || body?.key?.fromMe);

    // 3. Filtros de Segurança (Loop e Status)
    if (fromMe) {
      return { status: "ignored_self" };
    }

    if (!remoteJid || remoteJid.includes("status@broadcast")) {
      return { status: "ignored_broadcast_or_invalid" };
    }

    if (!messageText) {
      console.warn(`${LOG_PREFIX} payload sem texto legível de ${remoteJid}`);
      return { status: "ignored_no_text" };
    }

    console.log(`${LOG_PREFIX} 💬 Mensagem de ${remoteJid}: "${messageText}"`);

    // 4. Processamento com a IA (RAG)
    // Removemos o sufixo para o ID do usuário no banco de dados, mantendo apenas o número
    const userId = remoteJid.replace("@s.whatsapp.net", "");

    const reply = await this.generateReply(userId, messageText);

    // 5. Envio da Resposta
    // O sendMessage já trata a formatação do JID internamente
    await sendMessage(remoteJid, reply);

    console.log(`${LOG_PREFIX} 🤖 Resposta enviada para ${remoteJid}`);
    return { status: "ok", reply };
  }

  private async generateReply(userId: string, question: string): Promise<string> {
    try {
      const response = await this.ragController.askQuestion({
        question,
        userId,
      });

      const reply = response.answer?.trim();
      if (reply) return reply;
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Erro ao chamar RAG:`, error);
    }

    return FALLBACK_REPLY;
  }
}

// --- HELPERS (Extraem dados de estruturas complexas do WhatsApp) ---

function extractMessageContainer(body: any) {
  return (
    body?.data?.message ||
    body?.data?.messages?.[0]?.message ||
    body?.message ||
    body?.messages?.[0]?.message ||
    null
  );
}

function extractMessageText(message: any, body: any): string | undefined {
  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title || // Caso clique em uma lista
    message?.text ||
    body?.data?.body ||
    body?.text;

  return text?.trim();
}

function extractRemoteJid(body: any): string | undefined {
  const candidates = [
    body?.data?.key?.remoteJid,
    body?.data?.key?.participant,
    body?.data?.messages?.[0]?.key?.remoteJid,
    body?.key?.remoteJid,
    body?.remoteJid,
    body?.from,
  ];

  const raw = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return raw?.trim();
}