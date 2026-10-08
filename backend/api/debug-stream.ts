import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as vm from "vm";

const MAX_ITERATIONS = 5;

// Direct Gemini call in serverless environment
async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY in environment variables.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `Gemini API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini API.");
  return text.trim();
}

function extractCodeBlock(response: string): string | null {
  const match = response.match(/```(?:javascript|js)?\r?\n([\s\S]*?)```/i);
  return match && match[1] ? match[1].trim() : null;
}

// Safely execute JavaScript in an isolated VM sandbox
function runInSandbox(code: string): { stdout: string; stderr: string; exitCode: number } {
  let stdoutLogs: string[] = [];
  let stderrLogs: string[] = [];

  const sandboxContext = {
    console: {
      log: (...args: any[]) => stdoutLogs.push(args.map(String).join(" ")),
      error: (...args: any[]) => stderrLogs.push(args.map(String).join(" ")),
      warn: (...args: any[]) => stderrLogs.push(args.map(String).join(" ")),
      info: (...args: any[]) => stdoutLogs.push(args.map(String).join(" ")),
    },
    setTimeout,
    clearTimeout,
    process: {
      exit: (code: number = 0) => {
        if (code !== 0) throw new Error(`Process exited with status ${code}`);
      },
    },
  };

  try {
    const script = new vm.Script(code);
    const context = vm.createContext(sandboxContext);
    script.runInContext(context, { timeout: 3000 });
    return {
      stdout: stdoutLogs.join("\n"),
      stderr: stderrLogs.join("\n"),
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      stdout: stdoutLogs.join("\n"),
      stderr: err.stack || err.message || String(err),
      exitCode: 1,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, fileName } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code in request body." });
  }

  // Setup Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, payload: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  sendEvent("status", { message: `Started debugging session for ${fileName || "script.js"}` });

  let currentCode = code;
  let isFixed = false;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    sendEvent("iteration_start", {
      iteration,
      maxIterations: MAX_ITERATIONS,
      code: currentCode,
    });

    // OBSERVE
    sendEvent("step", { step: "observe", message: "Executing code in Node.js runtime..." });
    const runResult = runInSandbox(currentCode);

    if (runResult.exitCode === 0) {
      isFixed = true;
      sendEvent("success", {
        iteration,
        stdout: runResult.stdout || "Code ran cleanly with exit code 0",
        message: "Execution succeeded with exit code 0!",
      });

      // Learn lesson if we made fixes
      if (iteration > 1) {
        sendEvent("step", { step: "learn", message: "Synthesizing lesson for memory..." });
        const lessonPrompt = `You are a software engineering mentor.
A bug in the following JavaScript code was successfully fixed.

Original Code:
\`\`\`javascript
${code}
\`\`\`

Fixed Code:
\`\`\`javascript
${currentCode}
\`\`\`

Provide ONE short, general, one-line lesson about what went wrong and how to avoid it.
Do not write multiple lines or markdown bullets, just the single lesson sentence.`;

        try {
          const lesson = await askGemini(lessonPrompt);
          const cleanLesson = lesson.replace(/^[-*•]\s*/, "").split("\n")[0].trim();
          sendEvent("lesson_added", { lesson: cleanLesson });
        } catch {}
      }

      break;
    }

    const currentError = runResult.stderr.trim() || `Process exited with code ${runResult.exitCode}`;
    sendEvent("observed_error", {
      iteration,
      error: currentError,
      exitCode: runResult.exitCode,
    });

    // THINK
    sendEvent("step", { step: "think", message: "Consulting Gemini reasoning model..." });
    const prompt = `You are an automated JavaScript debugging agent.
The following JavaScript file encountered an error when executed with Node.js.

### Current Code:
\`\`\`javascript
${currentCode}
\`\`\`

### Error Output:
${currentError}

Provide a 1-2 sentence explanation of the bug, followed by the complete fixed JavaScript code inside ONE markdown code block (\`\`\`javascript ... \`\`\`).
Do not omit any part of the code.`;

    let llmResponse = "";
    try {
      llmResponse = await askGemini(prompt);
    } catch (err: any) {
      sendEvent("error", { message: err.message });
      break;
    }

    const explanation = llmResponse.split("```")[0].trim();
    sendEvent("explanation", { iteration, explanation });

    // ACT
    sendEvent("step", { step: "act", message: "Applying code patch to sandbox..." });
    let fixedCode = extractCodeBlock(llmResponse);
    if (!fixedCode) {
      try {
        const retryPrompt = `${prompt}\n\nIMPORTANT: You must include the full fixed code inside a markdown code block (\`\`\`javascript ... \`\`\`).`;
        llmResponse = await askGemini(retryPrompt);
        fixedCode = extractCodeBlock(llmResponse);
      } catch {}
    }

    if (!fixedCode) {
      sendEvent("error", { message: "Could not extract valid code block from AI response." });
      break;
    }

    currentCode = fixedCode;
    sendEvent("patch_applied", { iteration, newCode: currentCode });
  }

  if (!isFixed) {
    sendEvent("failed", { message: `Max ${MAX_ITERATIONS} attempts reached without success.` });
  }

  sendEvent("done", { isFixed });
  res.end();
}
