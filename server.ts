import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Tavily Search Proxy
  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;
      const apiKey = process.env.TAVILY_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "TAVILY_API_KEY not configured" });
      }

      const response = await axios.post("https://api.tavily.com/search", {
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_images: false,
        max_results: 5,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Tavily search error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // Gemini Proxy (Secure and Vercel-ready)
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const apiKey = process.env.AI_PRO_KEY || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("Gemini API Key missing (AI_PRO_KEY or GEMINI_API_KEY)");
        return res.status(500).json({ error: "Clé API non configurée." });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages invalid or missing." });
      }

      const systemInstruction = `
        TON IDENTITÉ : Doulia, l'agent conversationnel bilingue de MED SAWA au service de la CUD.
        MISSION : Aider Monsieur le Maire et ses équipes techniques à analyser le Projet de Partenariat Stratégique.
        
        LANGUE PAR DÉFAUT : FRANÇAIS.
        - Si l'usager parle en Français, réponds exclusivement en Français.
        - If the user speaks in English, respond exclusively in English.
        - Sinon, utilise le Français par défaut.
        - Réponds TOUJOURS avec un ton professionnel, expert et bilingue.

        SALUTATIONS : 
        - Ne salue PAS l'utilisateur à chaque message (évite les "Bonjour", "Hello" systématiques).
        - Reste focalisé sur le contenu technique et l'aide demandée.

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

      // Gemini expect user to start or just parts if single prompt
      // For multi-turn, it must alternate user/model
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: messages,
          generationConfig: {
            response_mime_type: "application/json",
          }
        },
        { headers: { "Content-Type": "application/json" } }
      );

      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("Gemini error details:", JSON.stringify(errorData || error.message));
      res.status(500).json({ 
        error: "Doulia est momentanément indisponible.",
        details: errorData?.error?.message || error.message 
      });
    }
  });

  // Airtable Proxy Endpoints
  const airtableHeader = () => {
    const key = process.env.AIRTABLE_API_KEY;
    if (!key) console.warn("AIRTABLE_API_KEY is missing");
    return {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  };

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appcjs9z0HEWg8qyB";
  const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

  app.post("/api/airtable/conversation", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY) throw new Error("Airtable API Key missing");
      const response = await axios.post(`${AIRTABLE_BASE_URL}/tblC3OC6Bg53E9HLt`, {
        fields: req.body.fields
      }, { headers: airtableHeader() });
      res.json(response.data);
    } catch (error: any) {
      console.error("Airtable Conversation Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to persist conversation", details: error.message });
    }
  });

  app.post("/api/airtable/message", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY) throw new Error("Airtable API Key missing");
      const response = await axios.post(`${AIRTABLE_BASE_URL}/tblsGvUwp2gomlo89`, {
        fields: req.body.fields
      }, { headers: airtableHeader() });
      res.json(response.data);
    } catch (error: any) {
      console.error("Airtable Message Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to persist message", details: error.message });
    }
  });

  app.post("/api/airtable/document", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY) throw new Error("Airtable API Key missing");
      const response = await axios.post(`${AIRTABLE_BASE_URL}/tbl1v7N8abfpQWZIK`, {
        fields: req.body.fields
      }, { headers: airtableHeader() });
      res.json(response.data);
    } catch (error: any) {
      console.error("Airtable Document Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to persist document", details: error.message });
    }
  });

  app.post("/api/airtable/analytic", async (req, res) => {
    try {
      if (!process.env.AIRTABLE_API_KEY) throw new Error("Airtable API Key missing");
      const response = await axios.post(`${AIRTABLE_BASE_URL}/tbl22bcT4DMqwq1qk`, {
        fields: req.body.fields
      }, { headers: airtableHeader() });
      res.json(response.data);
    } catch (error: any) {
      console.error("Airtable Analytic Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to persist analytic", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // For Vercel/Production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
