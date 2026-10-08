# PROJECT.md - Build "debug-agent"

> **To the coding agent:** Read this whole file before writing any code.
> Then build the project by following the WORKING RULES and TASKS below, in order.
> Do ONE task, test it, report, and STOP. Wait for the user to say "next".
> This file is the single source of truth for what to build and why.

---

## 1. What we are building

A small **Node.js + TypeScript CLI** called `debug-agent`.

It takes a buggy JavaScript file, runs it, reads the error, asks the Gemini API for
a fix, writes the fix, and runs it again. It repeats until the file runs without
errors (max 5 attempts). After a successful fix it saves a short lesson in
`memory.md`, and loads that file at the start of every run, so it does not repeat
old mistakes.

Usage: `npx tsx src/index.ts <path-to-buggy-js-file>`

This is a **prototype**. Keep the code simple, readable and well commented.
Do not add features that are not listed here.

---

## 2. Concepts this project must demonstrate

This project is a learning prototype for the video "AI Agents Full Course 2026:
Master Agentic AI". Each concept below must be visible in the code.

**Core idea: Agent = LLM + Tools + Reasoning loop + Memory.**

| Concept | How it must appear in the code | Where |
|---|---|---|
| LLM (the thinking part) | Gemini API call that explains the bug and returns fixed code | `src/llm.ts` |
| Tools (how the agent acts on the world) | Separate functions: `readFile`, `writeFile`, `runCode` | `src/tools.ts` |
| Reasoning loop | Observe -> Think -> Act, repeated until done | `src/index.ts` |
| Loop ends when task is complete | Stop when exit code is 0, or after max 5 iterations | `src/index.ts` |
| Persistent memory | `memory.md` loaded on every run and included in the prompt | `src/memory.ts` |
| Learning from mistakes | After a successful fix, save one general one-line lesson to `memory.md` | `src/index.ts`, `src/memory.ts` |

### The loop

```
OBSERVE : runCode(file) -> stdout, stderr, exitCode
          exitCode == 0 ?  -> print "Fixed!", save lesson, STOP
THINK   : send code + error + memory.md to the LLM
          LLM returns: 1-2 sentence explanation + full fixed code
ACT     : writeFile(file, fixed code)
          go back to OBSERVE (max 5 iterations, then STOP with last error)
```

### Why each part exists
- **Tools:** the LLM alone cannot know if its fix works. `runCode` gives it the real result.
- **Loop:** one attempt is often not enough. The loop lets the agent see the result of its own fix and try again.
- **Memory:** a plain markdown file is enough to make the agent remember past mistakes between sessions.
- **Learning:** each success adds a lesson, so future runs get better context.

### Out of scope (do NOT build these now)
Multi-agent orchestration, agent chat rooms or debates, a web UI, a database.

---

## 3. Project structure

```
debug-agent/
├── src/
│   ├── index.ts      # agent loop (observe -> think -> act)
│   ├── tools.ts      # readFile, writeFile, runCode
│   ├── llm.ts        # Gemini API call
│   └── memory.ts     # loadMemory, addLesson
├── buggy/
│   └── example.js    # test file with a known bug
├── memory.md         # learned lessons (created and updated by the agent)
├── .env              # GEMINI_API_KEY, GEMINI_MODEL (never commit)
├── .env.example
├── PROJECT.md        # this file
└── README.md
```

---

## 4. WORKING RULES (the agent MUST follow these)

1. Work on ONE task at a time, in order. Never start Task N+1 before Task N is done.
2. A task is done only when ALL its "Verify" checks pass. Run the real commands and
   read the real output. Never assume something works.
3. If anything fails (error, wrong output, crash), STOP. Fix it first, then re-run
   the Verify checks of the SAME task. Do not move on with a known error.
4. Maximum 3 fix attempts per problem. If it still fails, write it in the "Blockers"
   section at the end of this file (task number, error, what you tried) and ask
   the user. Do not skip the task.
5. Only touch files that belong to the current task, plus fixing earlier tasks if a
   bug is found there. Do not create files for future tasks.
6. Status markers: `[ ]` not started, `[~]` in progress, `[x]` done.
   Only ONE task may be `[~]` at any time.
7. NEVER move to the next task on your own. When a task is finished and ALL its
   Verify checks have passed (tested with real commands), do this and then STOP:
   a. Mark the task `[x]` and add one line to the "Progress Log" with the Verify result.
   b. Show the user a short report: what was built, which tests you ran, and their output.
   c. Wait. Start the next task only after the user explicitly says "next".
   If the task is not tested yet or any check is failing, the task is NOT finished:
   keep fixing it (rule 3) and do not report it as done.
8. Never hardcode the API key or the model name. Read both from `.env`.
9. The agent runs code on the user's machine. Only run the files in `buggy/` that
   the user placed there.

---

## 5. TASKS

### [x] Task 0 - Project setup
**Goal:** An empty but working TypeScript project.
**Steps:**
- `npm init -y`, then install `typescript`, `tsx`, `dotenv`, `@types/node`.
- Create the folders `src/` and `buggy/`.
- Create `.env.example` with `GEMINI_API_KEY=` and `GEMINI_MODEL=`.
- Create `.gitignore` containing `.env` and `node_modules`.
- Create `src/index.ts` that only prints "debug-agent ready".
**Verify:**
- `npx tsx src/index.ts` prints "debug-agent ready" with no errors.

### [x] Task 1 - Tools (`src/tools.ts`)
**Goal:** The three tool functions the agent will use.
**Steps:**
- `readFile(path)` returns the file text.
- `writeFile(path, content)` writes the file.
- `runCode(path)` runs the JS file with Node in a child process, 5 second timeout,
  and returns `{ stdout, stderr, exitCode, timedOut }`.
- Create `buggy/example.js` with exactly this code:
  ```js
  const items = [1, 2, 3];
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].value;
  }
  console.log(total);
  ```
**Verify:**
- `runCode("buggy/example.js")` returns a non-zero exit code and stderr containing a TypeError.
- A temporary file with `while(true){}` is stopped by the timeout (`timedOut: true`).
- `readFile` and `writeFile` work on a temporary file. Delete the temporary files afterwards.

### [x] Task 2 - LLM call (`src/llm.ts`)
**Goal:** One function that sends a prompt to Gemini and returns the text.
**Steps:**
- Read `GEMINI_API_KEY` and `GEMINI_MODEL` from `.env` using dotenv.
- Use the Gemini REST API with Node's built-in `fetch` (no extra SDK).
- Handle: missing key (clear message), HTTP errors, empty response.
**Verify:**
- A test prompt such as "Say hello" returns text.
- With the key removed, a clear "missing API key" message is printed, with no stack trace.

### [x] Task 3 - Memory (`src/memory.ts`)
**Goal:** Load and save lessons in `memory.md`.
**Steps:**
- `loadMemory()` returns the file content. If the file is missing, create it with a title (`# Agent Memory`).
- `addLesson(text)` appends a bullet: `- YYYY-MM-DD: <text>`.
- Keep only the last 20 lessons.
**Verify:**
- Add 22 test lessons: the file keeps exactly the last 20.
- Deleting `memory.md` and calling `loadMemory()` recreates it without errors.
- Remove the test lessons afterwards.

### [x] Task 4 - Agent loop (`src/index.ts`)
**Goal:** The observe -> think -> act loop from section 2 (max 5 iterations).
**Steps:**
- Read the file path from the command line.
- OBSERVE with `runCode`. If the exit code is 0, print "Fixed!" and stop.
- THINK: send the code, the error output and the `memory.md` content to Gemini. Ask for a
  1-2 sentence explanation and the full fixed code in ONE code block.
- ACT: extract the code block, make a `<file>.bak` copy on the first iteration only,
  write the fix with `writeFile`, then loop.
- Print each iteration clearly: attempt number, error, explanation.
**Verify:**
- `npx tsx src/index.ts buggy/example.js` ends with "Fixed!" and `node buggy/example.js`
  now runs without errors.
- `buggy/example.js.bak` contains the original buggy code.

### [x] Task 5 - Learn from fixes
**Goal:** After a successful fix, the agent saves a lesson (the "learning" concept).
**Steps:**
- On success, ask Gemini for ONE short, general, one-line lesson about the bug.
- Save it with `addLesson`.
- Add a `--verbose` flag that prints the full prompt, so the lessons can be seen in it.
**Verify:**
- Restore `buggy/example.js` from the `.bak`, run the agent again: `memory.md` has a new
  dated lesson, and with `--verbose` the earlier lessons appear in the prompt.

### [x] Task 6 - Error handling and limits
**Goal:** The agent fails safely.
**Steps:**
- No code block in the LLM response: retry once, then stop with a clear message.
- Max 5 iterations reached: print what failed and the last error.
- Target file missing: clear message.
**Verify:**
- Test each case on purpose (wrong file path, a bug the agent cannot fix, an empty LLM
  response) and confirm clean messages and no crashes.

### [x] Task 7 - Final test and README
**Goal:** Everything works from a clean start.
**Steps:**
- Add two more buggy files in `buggy/`: one with a syntax error, one with an undefined variable.
- Write a short `README.md`: setup, `.env`, how to run, how memory works.
**Verify:**
- All three buggy files get fixed by the agent from a fresh run.
- The README steps work exactly as written.

---

## Blockers
(Write here when a problem is not solved after 3 attempts.)

## Progress Log
(One line per finished task, for example: `Task 1 done - runCode returns TypeError, timeout works`.)
- Task 0 done - npx tsx src/index.ts prints "debug-agent ready" with exit code 0.
- Task 1 done - runCode returns TypeError, timeout works (5s), readFile and writeFile verified.
- Task 2 done - askGemini tested via Gemini REST API, returned hello text, and clean error on missing key without stack trace.
- Task 3 done - loadMemory recreates file with title, addLesson keeps exactly the last 20 lessons with dates, test lessons removed.
- Task 4 done - Agent loop observed error, thought with Gemini, fixed buggy/example.js, backup created, verified exit code 0.
- Task 5 done - Agent learned lesson on fix, saved to memory.md, verified --verbose prints prompt with memory content.
- Task 6 done - Missing file exits cleanly, missing code block retries once and exits cleanly, limits verified without crashes.
- Task 7 done - Added syntax_error.js and undefined_var.js; all 3 buggy files fixed cleanly by agent; verified README.
