const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

/**
 * Sends a prompt to the Gemini API and returns the generated text.
 * Uses high-availability models with automatic fallback across models on 503 / 404.
 */
async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY in environment variables or .env file.");
  }

  // Active models in order of priority and current server capacity
  const preferredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const candidateModels = [
    preferredModel,
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
    "gemini-2.5-pro"
  ];
  const uniqueModels = [...new Set(candidateModels)];

  let lastErrorMsg = "";

  for (const targetModel of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      targetModel
    )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {
          if (errorText) errorMsg += `: ${errorText}`;
        }

        lastErrorMsg = `${targetModel}: ${errorMsg}`;

        // If 503 (high demand) or 404 (unavailable), try the next model immediately
        if (response.status === 503 || response.status === 404 || response.status === 429) {
          continue;
        }

        continue;
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const textPart = candidate?.content?.parts?.[0]?.text;

      if (!textPart || typeof textPart !== "string" || textPart.trim() === "") {
        throw new Error("Empty response received from Gemini API.");
      }

      return textPart.trim();
    } catch (err) {
      lastErrorMsg = err.message || String(err);
      continue;
    }
  }

  throw new Error(`Gemini request failed: ${lastErrorMsg}`);
}

module.exports = {
  askGemini,
};
