import Http from "../Http";
import sendMessage from "../../../domain/Services/sendMessageService";
import RagController from "../../controller/RagController";

const LOG_PREFIX = "[EvolutionAPI:webhook]";
const FALLBACK_REPLY = "Desculpe, não consegui entender sua mensagem.";

export default class EvolutionRoutes {
  constructor(
    readonly http: Http,
    private readonly ragController: RagController
  ) {}

  init(): void {
    const paths = [
      "/webhook/evolution",
      "/ask/contact-update",
      "/ask/contact-update/:event",
    ];

    for (const path of paths) {
      this.http.route("post", path, false, async (params: any, body: any) => {
        return this.handleWebhook(path, params, body);
      });
    }
  }

  private async handleWebhook(path: string, params: any, body: any) {
    console.log(`${LOG_PREFIX} payload recebido (${path})`, JSON.stringify(body));

    const event = body?.event || body?.type || params?.event;
    if (event && event !== "messages.upsert") {
      console.log(`${LOG_PREFIX} evento ignorado: ${event}`);
      return { status: "ignored" };
    }

    const message = extractMessageContainer(body);
    const messageText = extractMessageText(message, body);
    const remoteJid = extractRemoteJid(body);
    const fromMe = Boolean(body?.data?.key?.fromMe || body?.key?.fromMe);

    if (fromMe) {
      console.log(`${LOG_PREFIX} mensagem enviada pela própria instância, ignorando.`);
      return { status: "ignored" };
    }

    if (!remoteJid || !messageText) {
      console.warn(`${LOG_PREFIX} payload incompleto`, {
        hasRemoteJid: Boolean(remoteJid),
        hasMessageText: Boolean(messageText),
      });
      return { status: "ignored" };
    }

    console.log(`${LOG_PREFIX} mensagem de ${remoteJid}: ${messageText}`);

    const reply = await this.generateReply(remoteJid, messageText);

    await sendMessage(remoteJid, reply);

    console.log(`${LOG_PREFIX} resposta enviada para ${remoteJid}`);
    return { status: "ok" };
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
      console.error(`${LOG_PREFIX} erro ao chamar RAG`, error);
    }

    return FALLBACK_REPLY;
  }
}

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
    message?.documentMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
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
    body?.data?.messages?.[0]?.key?.participant,
    body?.key?.remoteJid,
    body?.key?.participant,
    body?.remoteJid,
    body?.from,
  ];

  const raw = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return raw?.trim().replace(/\s+/g, "");
}
