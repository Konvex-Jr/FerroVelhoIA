import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Garante que pega o .env da raiz do projeto
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const baseUrl = process.env.EVOLUTION_API_URL;
const instance = process.env.EVOLUTION_INSTANCE;
const apiKey = process.env.EVOLUTION_API_KEY;

// Seu número de teste atualizado
const number = "5547999519493";

async function testSendMessage() {
  console.log("📂 Carregando configurações...");

  if (!baseUrl || !instance || !apiKey) {
    console.error("❌ ERRO: Variáveis de ambiente (EVOLUTION_*) não encontradas.");
    return;
  }

  console.log("EVOLUTION_INSTANCE:", instance);
  console.log("EVOLUTION_API_KEY:", apiKey ? "OK (Carregada)" : "FALTANDO");

  console.log(`📤 Enviando mensagem de teste para ${number}...`);

  // Remove barra final se houver
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${cleanBaseUrl}/message/sendText/${instance}`;

  const payload = {
    number, // número puro (Evolution aceita assim ou com @s.whatsapp.net)
    text: "fala",
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      // validateStatus: () => true // Comentei para cair no catch se der erro (400/500)
    });

    console.log("✅ Sucesso! Resultado:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("❌ Erro ao enviar:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Mensagem:", error.message);
    }
  }
}

testSendMessage();