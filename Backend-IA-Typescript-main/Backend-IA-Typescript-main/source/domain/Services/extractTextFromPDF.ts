import pdf from "pdf-parse";

export async function extractPdfText(file: Express.Multer.File): Promise<string> {
  if (!file || !file.buffer) throw new Error("Arquivo inválido");
  const data = await pdf(file.buffer);
  return data.text;
}
