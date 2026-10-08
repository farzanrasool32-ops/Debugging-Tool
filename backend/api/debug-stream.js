const vm = require("vm");
const path = require("path");
const dotenv = require("dotenv");
const { askGemini } = require("../src/llm");
const { addLesson } = require("../src/memory");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const MAX_ITERATIONS = 5;

function extractCodeBlock(response) {
  const match = response.match(/```(?:javascript|js)?\r?\n([\s\S]*?)```/i);
  return match && match[1] ? match[1].trim() : null;
}

// Safely execute JavaScript in an isolated VM sandbox
function runInSandbox(code) {
  let stdoutLogs = [];
  let stderrLogs = [];

  const sandboxContext = {
    console: {
      log: (...args) => stdoutLogs.push(args.map(String).join(" ")),
      error: (...args) => stderrLogs.push(args.map(String).join(" ")),
      warn: (...args) => stderrLogs.push(args.map(String).join(" ")),
      info: (...args) => stdoutLogs.push(args.map(String).join(" ")),
    },
    setTimeout,
    clearTimeout,
    process: {
      exit: (code = 0) => {
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
  } catch (err) {
    return {
      stdout: stdoutLogs.join("\n"),
      stderr: err.stack || err.message || String(err),
      exitCode: 1,
    };
  }
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status ? res.status(204).end() : (res.statusCode = 204, res.end());
  }

  if (req.method !== "POST") {
    if (res.status) {
      return res.status(405).json({ error: "Method not allowed" });
    }
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const { code, fileName } = req.body || {};

  if (!code || typeof code !== "string") {
    if (res.status) {
      return res.status(400).json({ error: "Missing code in request body." });
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Missing code in request body." }));
  }

  // Setup Server-Sent Events (SSE)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (type, payload) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    if (res.flush) res.flush();
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
          addLesson(cleanLesson);
          sendEvent("lesson_added", { lesson: cleanLesson });
        } catch (e) {
          console.warn("Could not save lesson:", e.message);
        }
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
    } catch (err) {
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

module.exports = handler;
module.exports.default = handler;
