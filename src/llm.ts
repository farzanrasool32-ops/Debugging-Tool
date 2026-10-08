import dotenv from "dotenv";

dotenv.config();

/**
 * Sends a prompt to the Gemini API and returns the generated text.
 * Handles missing API key, HTTP errors, and empty responses cleanly without stack traces.
 */
export async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  if (!apiKey || apiKey.trim() === "") {
    console.error("Error: Missing GEMINI_API_KEY in .env file.");
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const maxRetries = 3;
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
            errorMsg = `Gemini API Error (${response.status}): ${parsed.error.message}`;
          }
        } catch {
          if (errorText) {
            errorMsg += `: ${errorText}`;
          }
        }

        // Retry on 503 high demand
        if (response.status === 503 && attempt < maxRetries) {
          console.warn(`Gemini 503 high demand. Retrying in ${attempt * 2}s...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }

        console.error(errorMsg);
        process.exit(1);
      }

      const data = (await response.json()) as any;
      const candidate = data?.candidates?.[0];
      const textPart = candidate?.content?.parts?.[0]?.text;

      if (!textPart || typeof textPart !== "string" || textPart.trim() === "") {
        console.error("Error: Empty response received from Gemini API.");
        process.exit(1);
      }

      return textPart.trim();
    } catch (err: any) {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      console.error(`Network error: ${err.message || String(err)}`);
      process.exit(1);
    }
  }

  process.exit(1);
}
