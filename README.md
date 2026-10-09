# debug-agent

An autonomous AI debugging CLI tool and Web UI built with Node.js and Gemini API.

### 🌐 Live Deployments
- **Frontend Web UI**: [https://debugging-tool-frontend.vercel.app](https://debugging-tool-frontend.vercel.app/)
- **Backend API Service**: [https://debugging-tool-frontend.vercel.app](https://debugging-tool-frontend.vercel.app/)

It takes a buggy JavaScript file, executes it, captures errors, consults the Gemini model for root cause analysis and a fix, writes the fix, and iteratively validates until the file runs cleanly (or reaches the maximum limit of 5 attempts). After each successful fix, it records general lessons in `memory.md` so that future runs do not repeat past mistakes.

---

## 1. Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm

### Installation
Clone the repository and install the dependencies:
```bash
npm install
```

---

## 2. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
(On Windows PowerShell: `Copy-Item .env.example .env`)

Set your Gemini API credentials in `.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Note:** Never commit your `.env` file. It is ignored by Git in `.gitignore`.

---

## 3. How to Run

Run the agent on any buggy JavaScript file:

```bash
node backend/src/index.js <path-to-buggy-js-file>
```

For detailed logging (including memory state and the full prompt sent to the LLM), supply the `--verbose` flag:

```bash
node backend/src/index.js --verbose <path-to-buggy-js-file>
```

### Examples
Test with the built-in sample files in `backend/buggy/`:

```bash
# Off-by-one and undefined property bug
node backend/src/index.js backend/buggy/example.js

# Missing parenthesis syntax error
node backend/src/index.js backend/buggy/syntax_error.js

# Undefined scope reference error
node backend/src/index.js backend/buggy/undefined_var.js
```

---

## 4. How Persistent Memory Works

The agent uses `memory.md` to store lessons learned from previous fixes:
1. When the agent successfully resolves a bug, it prompts Gemini for a concise, general software engineering takeaway.
2. The lesson is formatted and appended to `memory.md` as `- YYYY-MM-DD: <lesson>`.
3. Only the last 20 lessons are retained (using a sliding window) to prevent prompt bloat.
4. On every subsequent run, the contents of `memory.md` are automatically loaded and injected into the Gemini debugging prompt so the agent gains long-term context and avoids repeating mistakes.

---

## 5. Web UI Dashboard

You can also run the agent using a real-time web dashboard:

```bash
npm run server
```

Then open the frontend (e.g. `frontend/index.html` in browser or Live Server). The backend runs at **[http://localhost:3001](http://localhost:3001)**.

### Web UI Features:
- **Interactive Code Workspace:** Select built-in buggy presets or paste your own code directly.
- **Visual Observe-Think-Act Stepper:** Live stepper showing Observe -> Think -> Act -> Learn stages.
- **Server-Sent Events (SSE):** Real-time streaming of error traces, Gemini reasoning explanations, and code patches without page reloads.
- **Live Memory Inspector:** View lessons stored in `memory.md` with timestamps.
- **Execution Terminal Console:** Raw log feed with timestamps.

---

## 6. Architecture

- **`src/tools.ts`**: Core execution primitives (`readFile`, `writeFile`, `runCode` with timeout).
- **`src/llm.ts`**: Direct REST API client for Google Gemini with automated retry logic on high-demand spikes.
- **`src/memory.ts`**: Persistent memory management (`loadMemory`, `addLesson`).
- **`src/index.ts`**: Autonomous Observe -> Think -> Act CLI agent loop.
- **`src/server.ts`**: HTTP & SSE backend streaming autonomous debugging events to the web UI.
- **`public/`**: Modern dashboard UI (HTML5, Vanilla CSS dark mode with glassmorphism, JetBrains Mono font, and vanilla JS).
