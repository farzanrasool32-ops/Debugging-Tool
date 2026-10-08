const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

/**
 * Sends a prompt to the Gemini API and returns the generated text.
 * Uses available Gemini models like gemini-3.8-flash, with automatic fallback and retry.
 */
async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY in environment variables or .env file.");
  }

  const candidateModels = [model, "gemini-3.8-flash", "gemini-2.5-flash-lite"];
  // Deduplicate candidate models
  const uniqueModels = [...new Set(candidateModels)];

  let lastErrorMsg = "";

  for (const targetModel of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      targetModel
    )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          let errorMsg = `Gemini API Error (HTTP ${response.status})`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error?.message) {
              errorMsg = parsed.error.message;
            }
          } catch {
            if (errorText) errorMsg += `: ${errorText}`;
          }

          lastErrorMsg = errorMsg;

          // If model is retired or not found (404), try next model immediately
          if (response.status === 404) {
            break;
          }

          // Retry on temporary 503 spike
          if (response.status === 503 && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
            continue;
          }

          break;
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
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
  }

  throw new Error(`Gemini request failed: ${lastErrorMsg}`);
}

module.exports = {
  askGemini,
};
