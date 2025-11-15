import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

console.log("Carregando .env de:", path.resolve(__dirname, "../../../.env"));
console.log("EVOLUTION_INSTANCE:", process.env.EVOLUTION_INSTANCE);
console.log("EVOLUTION_API_KEY:", process.env.EVOLUTION_API_KEY ? "OK" : "FALTANDO");

export default async function sendMessage(to: string, text: string) {
  const baseUrl =
    process.env.EVOLUTION_API_URL ||
    "https://ferro-velho-evolution-api.ixbtpi.easypanel.host";
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!instance || !apiKey) {
    console.error("Variáveis de ambiente ausentes: EVOLUTION_INSTANCE ou EVOLUTION_API_KEY");
    return;
  }

  if (!text.trim()) {
    console.warn(`Tentativa de enviar mensagem vazia para ${to}`);
    return;
  }

  const cleanNumber = to.replace(/\D/g, "");
  const jid = `${cleanNumber}@s.whatsapp.net`;

  const url = `${baseUrl}/message/sendText/${instance}`;
  const payload = {
    number: jid,
    options: {
      delay: 1200,
      presence: "composing",
    },
    textMessage: {
      text,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      timeout: 15000,
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`Mensagem enviada com sucesso para ${to}`);
      return response.data;
    } else {
      console.error(`Erro ao enviar mensagem. Status: ${response.status}`);
      return null;
    }
  } catch (error: any) {
    console.error("Erro ao enviar mensagem:", {
      status: error?.response?.status,
      error: error?.response?.data?.error || error.message,
      response: error?.response?.data,
    });
    return null;
  }
}
