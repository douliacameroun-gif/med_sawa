import axios from "axios";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;
    const apiKey = process.env.AI_PRO_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "AI key not configured" });
    }

    const systemInstruction = `
      TON IDENTITÉ : Doulia, l'agent conversationnel bilingue de MED SAWA au service de la CUD.
      MISSION : Aider Monsieur le Maire et ses équipes techniques à analyser le Projet de Partenariat Stratégique.
      
      LANGUE PAR DÉFAUT : FRANÇAIS.
      - Si l'usager parle en Français, réponds exclusivement en Français.
      - If the user speaks in English, respond exclusively in English.
      - Sinon, utilise le Français par défaut.
      - Réponds TOUJOURS avec un ton professionnel, expert et bilingue.

      STRICTES INTERDICTIONS :
      1. JAMAIS de balises HTML dans tes réponses.
      2. JAMAIS de caractères '#' ou '*' dans tes paragraphes.
      3. Pas de syntaxe Markdown pour le formatage.

      RÉPONSE FORMATÉE EN JSON UNIQUEMENT :
      {
        "titre": "...",
        "paragraphes": ["...", "..."],
        "motsCles": ["...", "..."],
        "etapeSuivante": "...",
        "suggestions": ["...", "..."]
      }
    `;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: messages,
        generationConfig: {
          response_mime_type: "application/json",
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Gemini error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to communicate with Doulia." });
  }
}
