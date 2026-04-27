import axios from "axios";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || "appcjs9z0HEWg8qyB";

  if (!apiKey) {
    return res.status(500).json({ error: "AIRTABLE_API_KEY not configured" });
  }

  try {
    const response = await axios.post(`https://api.airtable.com/v0/${baseId}/tbl1v7N8abfpQWZIK`, {
      fields: req.body.fields
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Airtable Document Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to persist document", details: error.message });
  }
}
