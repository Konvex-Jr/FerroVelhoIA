import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_API_URL = "https://ferro-velho-evolution-api.ixbtpi.easypanel.host";
const LOG_PREFIX = "[EvolutionAPI:sendMessage]";

export default async function sendMessage(remoteJid: string, text: string) {
  const baseUrl = (process.env.EVOLUTION_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!instance || !apiKey) {
    throw new Error("Variáveis de ambiente ausentes: EVOLUTION_INSTANCE ou EVOLUTION_API_KEY");
  }

  const sanitizedJid = sanitizeRemoteJid(remoteJid);
  if (!sanitizedJid) {
    throw new Error(`remoteJid inválido recebido: ${remoteJid}`);
  }

  const sanitizedText = text?.trim();
  if (!sanitizedText) {
    console.warn(`${LOG_PREFIX} tentativa de envio vazia para ${sanitizedJid}`);
    return;
  }

  const url = `${baseUrl}/message/sendText/${instance}`;
  const payload = {
    number: sanitizedJid,
    text: sanitizedText,
  };

  console.log(`${LOG_PREFIX} Enviando resposta para ${sanitizedJid}`);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      timeout: 20000,
      timeoutErrorMessage: "Timeout ao enviar mensagem para Evolution API",
    });

    console.log(`${LOG_PREFIX} Mensagem entregue para ${sanitizedJid}`);
    return response.data;
  } catch (error) {
    handleAxiosError(error);
  }
}

function sanitizeRemoteJid(remoteJid?: string): string | undefined {
  if (!remoteJid || typeof remoteJid !== "string") return undefined;

  const trimmed = remoteJid.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace(/\s+/g, "");
  if (!normalized.includes("@")) return normalized;

  const [userPart, ...domainParts] = normalized.split("@");
  if (!userPart || !domainParts.length) return undefined;

  const domain = domainParts.join("@").toLowerCase();
  return `${userPart}@${domain}`;
}

function handleAxiosError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = error.message;

    console.error(`${LOG_PREFIX} erro`, {
      status,
      data,
      message,
      code: error.code,
    });

    if (error.code === "ECONNABORTED") {
      throw new Error("Timeout ao enviar mensagem para Evolution API");
    }

    throw new Error(data?.error || data?.message || message || "Falha ao enviar mensagem pela Evolution API");
  }

  console.error(`${LOG_PREFIX} erro inesperado`, error);
  throw new Error("Erro desconhecido ao enviar mensagem pela Evolution API");
}
