import Http from "../Http";
import sendMessage from "../../../domain/Services/sendMessageService";
import RagController from "../../controller/RagController";

export default class EvolutionRoutes {
  constructor(
    readonly http: Http,
    private readonly ragController: RagController
  ) {}

  init(): void {

    this.http.route("post", "/webhook/evolution", false, async (_params: any, body: any) => {
    try {

      // Ignora mensagens enviadas pelo próprio bot
        const isFromMe = body?.data?.key?.fromMe || body?.key?.fromMe || false;
        if (isFromMe) {
            return { status: "ignored_self" };
        }
        const messageData =
        body?.data?.message?.conversation ||
        body?.data?.message?.extendedTextMessage?.text ||
        body?.message?.text ||
        body?.message?.conversation ||
        body?.text; 

      const from =
        body?.data?.key?.remoteJid?.replace("@s.whatsapp.net", "") ||
        body?.from?.replace("@s.whatsapp.net", "") ||
        body?.remoteJid?.replace("@s.whatsapp.net", "");

      if(!messageData || !from || from === "status@broadcast") {
        console.log("❌ Webhook ignorado - formato inválido:", body);
        return { status: "ignored" };
      }

      console.log(`💬 Mensagem recebida de ${from}: ${messageData}`);

      const response = await this.ragController.askQuestion({
        question: messageData,
        userId: from,
      });

      const reply = response.answer || "Desculpe, não consegui entender.";

      await sendMessage(from, reply);

      console.log(`🤖 Resposta enviada para ${from}: ${reply}`);

      return { status: "ok", reply };
    } catch (err) {
      console.error("Erro no webhook Evolution:", err);
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

}
