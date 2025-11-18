import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Garante o carregamento do .env da raiz
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULT_API_URL = "https://ferro-velho-evolution-api.ixbtpi.easypanel.host";
const LOG_PREFIX = "[EvolutionAPI:sendMessage]";

export default async function sendMessage(remoteJid: string, text: string) {
  // Remove barra no final da URL se houver
  const baseUrl = (process.env.EVOLUTION_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!instance || !apiKey) {
    throw new Error("Variáveis de ambiente ausentes: EVOLUTION_INSTANCE ou EVOLUTION_API_KEY");
  }

  // Sanitiza e garante o formato correto do ID do WhatsApp
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
    text: sanitizedText, // Se falhar, troque para: textMessage: { text: sanitizedText }
    options: {
      delay: 1200,
      presence: "composing",
    }
  };

  console.log(`${LOG_PREFIX} Enviando resposta para ${sanitizedJid}`);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      timeout: 20000, // 20 segundos de timeout
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

  // Remove espaços e caracteres não alfanuméricos (exceto @ e . e -)
  const normalized = trimmed.replace(/[^a-zA-Z0-9@.-]/g, "");

  // Se já tem @ (ex: grupo ou já formatado), valida e retorna
  if (normalized.includes("@")) {
    const [userPart, ...domainParts] = normalized.split("@");
    if (!userPart || !domainParts.length) return undefined;
    const domain = domainParts.join("@").toLowerCase();
    return `${userPart}@${domain}`;
  }

  // --- MELHORIA DE SEGURANÇA ---
  // Se só tem números (que é o que o AskQuestion envia), adiciona o sufixo padrão
  // Isso previne erro na API se ela esperar o JID completo
  return `${normalized}@s.whatsapp.net`;
}

function handleAxiosError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = error.message;

    console.error(`${LOG_PREFIX} erro HTTP`, {
      status,
      data: JSON.stringify(data, null, 2), // Melhora a visualização do log
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