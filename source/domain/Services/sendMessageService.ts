import axios from 'axios';
import dotenv from "dotenv";

dotenv.config();

export default async function sendMessage(to: string, message: string) {
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  const url = `https://ferro-velho-evolution-api.ixbtpi.easypanel.host/message/sendText/${instance}`;

  const payload = {
    number: to,
    text: message
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'insomnia/11.2.0',
        'apikey': apiKey,
      },
    });

    console.log('Mensagem enviada com sucesso:', response.data);
  } catch (error: any) {
    console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
  }
}