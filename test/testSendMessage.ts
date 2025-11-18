import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const baseUrl = process.env.EVOLUTION_API_URL!;
const instance = process.env.EVOLUTION_INSTANCE!;
const apiKey = process.env.EVOLUTION_API_KEY!;
const number = "5547999519493"; //  ajuste aqui se quiser testar outro número

async function testSendMessage() {
  console.log("Carregando .env de:", path.resolve(__dirname, "../.env"));
  console.log("EVOLUTION_INSTANCE:", instance);
  console.log("EVOLUTION_API_KEY:", apiKey ? "OK" : "FALTANDO");

  console.log("📤 Enviando mensagem de teste...");

  const url = `${baseUrl}/message/sendText/${instance}`;

  // ⚙️ formato EXATO que sua instância espera (sem textMessage)
  const payload = {
    number, // número puro, sem @s.whatsapp.net
    text: "fala",
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      validateStatus: () => true, // mostra resposta mesmo se 400
    });

    console.log("📩 Resultado:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("❌ Erro inesperado:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSendMessage();
