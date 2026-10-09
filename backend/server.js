const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const vm = require("vm");
const dotenv = require("dotenv");

// Load Environment Variables
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Standard Middlewares (Like any standard React/Node.js backend)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Memory File Constants
const MEMORY_FILE = path.resolve(__dirname, "memory.md");
const TITLE = "# Agent Memory\n";
const MAX_LESSONS = 20;

function loadMemoryContent() {
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, TITLE, "utf-8");
    return TITLE;
  }
  return fs.readFileSync(MEMORY_FILE, "utf-8");
}

function saveLessonToMemory(lessonText) {
  const current = loadMemoryContent();
  const lines = current.split(/\r?\n/);
  const lessons = [];
  const nonLesson = [];

  for (const line of lines) {
    if (line.trim().startsWith("- ")) {
      lessons.push(line.trim());
    } else if (line.trim().length > 0) {
      nonLesson.push(line);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  lessons.push(`- ${today}: ${lessonText.trim()}`);

  const kept = lessons.slice(-MAX_LESSONS);
  const header = nonLesson.length > 0 ? nonLesson.join("\n") + "\n\n" : TITLE + "\n";
  fs.writeFileSync(MEMORY_FILE, header + kept.join("\n") + "\n", "utf-8");
}

// Gemini AI Caller with High Availability & Model Fallback
async function askGeminiAI(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Missing GEMINI_API_KEY in backend/.env file.");
  }

  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
    "gemini-2.5-pro"
  ];
  const uniqueModels = [...new Set(candidateModels)];

  let lastError = "";

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        lastError = `Model ${model} (${resp.status}): ${errText}`;
        continue; // Try next model immediately
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  throw new Error(`Gemini AI service unavailable: ${lastError}`);
}

// Helper: Extract code inside markdown blocks
function extractCodeBlock(text) {
  const match = text.match(/```(?:javascript|js)?\r?\n([\s\S]*?)```/i);
  return match && match[1] ? match[1].trim() : null;
}

// Helper: Isolated sandbox execution
function runSandbox(code) {
  let stdoutLogs = [];
  let stderrLogs = [];

  const sandbox = {
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
      }
    }
  };

  try {
    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 3000 });
    return {
      stdout: stdoutLogs.join("\n"),
      stderr: stderrLogs.join("\n"),
      exitCode: 0
    };
  } catch (err) {
    return {
      stdout: stdoutLogs.join("\n"),
      stderr: err.stack || err.message || String(err),
      exitCode: 1
    };
  }
}

// ---------------- ROUTES ----------------

// 1. Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AutoDebug Agent Express Backend",
    time: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "AutoDebug Agent Node.js/Express Backend is running smoothly."
  });
});

// 2. Preset Buggy Files
app.get("/api/files", (req, res) => {
  const sampleFiles = [
    {
      name: "ecommerce_cart.js (🛒 E-Commerce Cart)",
      content: `// Testing App 1: E-Commerce Cart Total Calculator
// Bug: TypeError due to incorrect property access on cart items and missing price validation

const cart = [
  { id: 1, name: "Wireless Headphones", price: 89.99, quantity: 2 },
  { id: 2, name: "Mechanical Keyboard", cost: 120.00, quantity: 1 }, // Note: has 'cost' instead of 'price'
  { id: 3, name: "Mousepad XXL", price: 25.50, quantity: 3 }
];

function calculateCartTotal(items) {
  let subtotal = 0;
  for (let i = 0; i <= items.length; i++) {
    // Bug 1: Loop off-by-one error (i <= items.length)
    // Bug 2: Accessing .price on item with .cost
    subtotal += items[i].price * items[i].quantity;
  }
  
  const taxRate = 0.08;
  const grandTotal = subtotal + (subtotal * taxRate);
  return grandTotal.toFixed(2);
}

const total = calculateCartTotal(cart);
console.log("Cart Grand Total: $" + total);
`
    },
    {
      name: "auth_service.js (🔐 User Token Auth)",
      content: `// Testing App 2: User Authentication & JWT-like Token Parser
// Bug: Missing argument handling and JSON parsing unhandled syntax error

function parseUserSession(rawCookie) {
  const parts = rawCookie.split("; ");
  const tokenPair = parts.find(p => p.startsWith("session="));
  
  const encodedPayload = tokenPair.split("=")[1];
  
  // Bug: Trying to parse invalid JSON format (single quotes)
  const user = JSON.parse(encodedPayload); 
  
  if (user.role === "admin") {
    return "Access granted to admin: " + user.name;
  }
  return "Access granted to user: " + user.name;
}

// Simulated raw cookie with malformed payload string
const cookieString = "theme=dark; session={'id':101,'name':'Farzan','role':'admin'}";
console.log(parseUserSession(cookieString));
`
    },
    {
      name: "weather_analytics.js (⛅ Weather Sensor Analytics)",
      content: `// Testing App 3: Weather Data Analytics & Temperature Aggregator
// Bug: ReferenceError calling undefined function and NaN calculation

const weeklyForecast = [
  { day: "Mon", temp: 28, humidity: 65 },
  { day: "Tue", temp: "30", humidity: 70 }, // String instead of number
  { day: "Wed", temp: 26, humidity: 80 },
  { day: "Thu", temp: null, humidity: 60 },  // Null value
  { day: "Fri", temp: 31, humidity: 55 }
];

function getAverageTemperature(readings) {
  let totalTemp = 0;
  let count = 0;
  
  readings.forEach(reading => {
    // Bug: Undefined helper function 'validateSensorData' called
    if (validateSensorData(reading)) {
      totalTemp += reading.temp;
      count++;
    }
  });

  return (totalTemp / count).toFixed(1);
}

const avg = getAverageTemperature(weeklyForecast);
console.log("Weekly Average Temperature: " + avg + "°C");
`
    },
    {
      name: "pagination_helper.js (📄 Database Pagination Slicer)",
      content: `// Testing App 4: REST API Pagination & Cursor Slicer
// Bugs: Off-by-one slice and accessing .id on undefined index

const databaseRecords = [
  { id: 101, title: "Getting Started with AI", views: 1420 },
  { id: 102, title: "Node.js Concurrency Guide", views: 980 },
  { id: 103, title: "Mastering TypeScript Generics", views: 2310 },
  { id: 104, title: "Vercel Serverless Architecture", views: 1850 },
  { id: 105, title: "Building Autonomous Agents", views: 3200 }
];

function paginateResults(records, page, pageSize) {
  const startIndex = page * pageSize; 
  const endIndex = startIndex + pageSize;
  const pageItems = records.slice(startIndex, endIndex);

  // Bug: Accessing .id on pageItems[pageItems.length] (out of bounds)
  const nextCursor = pageItems[pageItems.length].id;

  return {
    page,
    itemsCount: pageItems.length,
    nextCursor,
    data: pageItems
  };
}

const page1 = paginateResults(databaseRecords, 1, 3);
console.log("Pagination Result:", JSON.stringify(page1));
`
    },
    {
      name: "example.js (Basic Array Loop)",
      content: `const items = [1, 2, 3];
let total = 0;
for (let i = 0; i <= items.length; i++) {
  total += items[i].value;
}
console.log(total);
`
    }
  ];

  res.json({ files: sampleFiles });
});

// 3. Memory API
app.get("/api/memory", (req, res) => {
  const content = loadMemoryContent();
  const lessons = content
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().replace(/^- /, ""));

  res.json({ raw: content, lessons });
});

// 4. Autonomous Debugging SSE Stream
app.post("/api/debug-stream", async (req, res) => {
  const { code, fileName } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code in request body." });
  }

  // Set SSE Headers
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
  const MAX_ITERATIONS = 5;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    sendEvent("iteration_start", {
      iteration,
      maxIterations: MAX_ITERATIONS,
      code: currentCode,
    });

    // 1. OBSERVE
    sendEvent("step", { step: "observe", message: "Executing code in Node.js runtime..." });
    const runResult = runSandbox(currentCode);

    if (runResult.exitCode === 0) {
      isFixed = true;
      sendEvent("success", {
        iteration,
        stdout: runResult.stdout || "Code ran cleanly with exit code 0",
        message: "Execution succeeded with exit code 0!",
      });

      // 4. LEARN
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
          const lesson = await askGeminiAI(lessonPrompt);
          const cleanLesson = lesson.replace(/^[-*•]\s*/, "").split("\n")[0].trim();
          saveLessonToMemory(cleanLesson);
          sendEvent("lesson_added", { lesson: cleanLesson });
        } catch (e) {
          console.warn("Could not save lesson:", e.message);
        }
      }

      break;
    }

    // Capture Runtime Error
    const currentError = runResult.stderr.trim() || `Process exited with code ${runResult.exitCode}`;
    sendEvent("observed_error", {
      iteration,
      error: currentError,
      exitCode: runResult.exitCode,
    });

    // 2. THINK
    sendEvent("step", { step: "think", message: "Consulting Gemini reasoning model..." });
    const memory = loadMemoryContent();
    const prompt = `You are an automated JavaScript debugging agent.
The following JavaScript file encountered an error when executed with Node.js.

### Memory of Past Lessons:
${memory}

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
      llmResponse = await askGeminiAI(prompt);
    } catch (err) {
      sendEvent("error", { message: err.message });
      break;
    }

    const explanation = llmResponse.split("```")[0].trim();
    sendEvent("explanation", { iteration, explanation });

    // 3. ACT
    sendEvent("step", { step: "act", message: "Applying code patch to sandbox..." });
    let fixedCode = extractCodeBlock(llmResponse);
    if (!fixedCode) {
      try {
        const retryPrompt = `${prompt}\n\nIMPORTANT: You must include the full fixed code inside a markdown code block (\`\`\`javascript ... \`\`\`).`;
        llmResponse = await askGeminiAI(retryPrompt);
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
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Express Backend Server is running on http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/health`);
  console.log(`   - GET  http://localhost:${PORT}/api/files`);
  console.log(`   - GET  http://localhost:${PORT}/api/memory`);
  console.log(`   - POST http://localhost:${PORT}/api/debug-stream`);
});

module.exports = app;
