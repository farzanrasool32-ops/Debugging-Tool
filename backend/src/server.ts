import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { runCode, writeFile, readFile } from "./tools";
import { askGemini } from "./llm";
import { loadMemory, addLesson } from "./memory";

const PORT = 3000;
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const BUGGY_DIR = path.resolve(__dirname, "../buggy");

function extractCodeBlock(response: string): string | null {
  const match = response.match(/```(?:javascript|js)?\r?\n([\s\S]*?)```/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local interaction
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: List sample buggy files
  if (pathname === "/api/files" && req.method === "GET") {
    try {
      const files = fs.readdirSync(BUGGY_DIR).filter((f) => f.endsWith(".js"));
      const list = files.map((fileName) => {
        const fullPath = path.join(BUGGY_DIR, fileName);
        return {
          name: fileName,
          content: fs.readFileSync(fullPath, "utf-8"),
        };
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ files: list }));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API 2: Get memory lessons
  if (pathname === "/api/memory" && req.method === "GET") {
    try {
      const content = loadMemory();
      const lessons = content
        .split(/\r?\n/)
        .filter((l) => l.trim().startsWith("- "))
        .map((l) => l.trim().replace(/^- /, ""));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ raw: content, lessons }));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API 3: Run autonomous agent loop with Server-Sent Events (SSE)
  if (pathname === "/api/debug-stream" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        let targetFilePath = data.filePath;
        const codeSnippet = data.code;

        // If custom code was sent, write it to a sandbox file in buggy/
        if (codeSnippet) {
          const customName = data.fileName || "sandbox_run.js";
          targetFilePath = path.join(BUGGY_DIR, customName);
          fs.writeFileSync(targetFilePath, codeSnippet, "utf-8");
        } else if (targetFilePath) {
          targetFilePath = path.resolve(BUGGY_DIR, targetFilePath);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing filePath or code" }));
          return;
        }

        // Setup SSE response
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const sendEvent = (type: string, payload: any) => {
          res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
        };

        sendEvent("status", { message: `Started debugging session for ${path.basename(targetFilePath)}` });

        const backupPath = `${targetFilePath}.bak`;
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(targetFilePath, backupPath);
        }

        let isFixed = false;
        const MAX_ITERATIONS = 5;

        for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
          sendEvent("iteration_start", {
            iteration,
            maxIterations: MAX_ITERATIONS,
            code: readFile(targetFilePath),
          });

          // OBSERVE
          sendEvent("step", { step: "observe", message: "Executing code in Node.js runtime..." });
          const runResult = runCode(targetFilePath);

          if (runResult.exitCode === 0) {
            isFixed = true;
            sendEvent("success", {
              iteration,
              stdout: runResult.stdout,
              message: "Execution succeeded with exit code 0!",
            });

            // Learn lesson if we made fixes
            if (iteration > 1) {
              sendEvent("step", { step: "learn", message: "Synthesizing lesson for memory.md..." });
              const originalBuggyCode = readFile(backupPath);
              const finalCode = readFile(targetFilePath);
              const lessonPrompt = `You are a software engineering mentor.
A bug in the following JavaScript code was successfully fixed.

Original Code:
\`\`\`javascript
${originalBuggyCode}
\`\`\`

Fixed Code:
\`\`\`javascript
${finalCode}
\`\`\`

Provide ONE short, general, one-line lesson about what went wrong and how to avoid it.
Do not write multiple lines or markdown bullets, just the single lesson sentence.`;

              try {
                const lessonText = await askGemini(lessonPrompt);
                const cleanLesson = lessonText.replace(/^[-*•]\s*/, "").split("\n")[0].trim();
                addLesson(cleanLesson);
                sendEvent("lesson_added", { lesson: cleanLesson });
              } catch (err: any) {
                sendEvent("log", { message: `Lesson generation skipped: ${err.message}` });
              }
            }

            break;
          }

          // Error observed
          const currentError = runResult.stderr.trim() || `Process exited with code ${runResult.exitCode}`;
          sendEvent("observed_error", {
            iteration,
            error: currentError,
            exitCode: runResult.exitCode,
          });

          // THINK
          sendEvent("step", { step: "think", message: "Consulting Gemini reasoning model..." });
          const currentCode = readFile(targetFilePath);
          const memoryContent = loadMemory();

          const prompt = `You are an automated JavaScript debugging agent.
The following JavaScript file encountered an error when executed with Node.js.

### Memory of Past Lessons:
${memoryContent}

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
          } catch (llmErr: any) {
            sendEvent("error", { message: `Gemini API error: ${llmErr.message}` });
            break;
          }

          const explanation = llmResponse.split("```")[0].trim();
          sendEvent("explanation", { iteration, explanation });

          // ACT
          sendEvent("step", { step: "act", message: "Applying code patch to filesystem..." });
          let fixedCode = extractCodeBlock(llmResponse);
          if (!fixedCode) {
            sendEvent("log", { message: "Retrying code extraction once..." });
            const retryPrompt = `${prompt}\n\nIMPORTANT: You must include the full fixed code inside a markdown code block (\`\`\`javascript ... \`\`\`).`;
            try {
              llmResponse = await askGemini(retryPrompt);
              fixedCode = extractCodeBlock(llmResponse);
            } catch {}
          }

          if (!fixedCode) {
            sendEvent("error", { message: "Could not extract valid code block from AI response." });
            break;
          }

          writeFile(targetFilePath, fixedCode + "\n");
          sendEvent("patch_applied", { iteration, newCode: fixedCode });
        }

        if (!isFixed) {
          sendEvent("failed", { message: `Max ${MAX_ITERATIONS} attempts reached without success.` });
        }

        sendEvent("done", { isFixed });
        res.end();
      } catch (err: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
    });
    return;
  }

  // Serve static UI files from /public
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };

  const contentType = mimeTypes[ext] || "text/plain";
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Debugger Real-Time Web UI running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
