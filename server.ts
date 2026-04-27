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

      console.log(`Searching Tavily for: ${query}`);
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
