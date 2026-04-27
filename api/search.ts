import axios from "axios";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Tavily search error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to perform search" });
  }
}
