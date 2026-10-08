const path = require("path");
const fs = require("fs");
const { readFile, writeFile, runCode } = require("./tools");
const { askGemini } = require("./llm");
const { loadMemory, addLesson } = require("./memory");

const MAX_ITERATIONS = 5;

/**
 * Extracts JavaScript code from LLM response containing a markdown code block.
 */
function extractCodeBlock(response) {
  const match = response.match(/```(?:javascript|js)?\r?\n([\s\S]*?)```/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const isVerbose = rawArgs.includes("--verbose");
  const fileArgs = rawArgs.filter((arg) => arg !== "--verbose");

  if (fileArgs.length === 0) {
    console.error("Usage: node src/index.js [--verbose] <path-to-buggy-js-file>");
    process.exit(1);
  }

  const targetFilePath = path.resolve(fileArgs[0]);

  // Target file missing check
  if (!fs.existsSync(targetFilePath)) {
    console.error(`Error: File not found at ${targetFilePath}`);
    process.exit(1);
  }

  // Backup original file on first run
  const backupPath = `${targetFilePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(targetFilePath, backupPath);
  }

  console.log(`Starting debug-agent for ${targetFilePath}...`);

  let lastObservedError = "";

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n--- Attempt ${iteration} of ${MAX_ITERATIONS} ---`);

    // OBSERVE
    const runResult = runCode(targetFilePath);

    if (runResult.exitCode === 0) {
      console.log("Fixed!");
      if (runResult.stdout.trim()) {
        console.log(`Program output:\n${runResult.stdout.trim()}`);
      }

      // If fixes were applied, synthesize and save lesson
      if (iteration > 1) {
        console.log("\nLearning lesson from fix...");
        const originalBuggyCode = readFile(backupPath);
        const fixedCode = readFile(targetFilePath);

        const lessonPrompt = `You are a software engineering mentor.
A bug in the following JavaScript code was successfully fixed.

Original Code:
\`\`\`javascript
${originalBuggyCode}
\`\`\`

Fixed Code:
\`\`\`javascript
${fixedCode}
\`\`\`

Provide ONE short, general, one-line lesson about what went wrong and how to avoid it.
Do not write multiple lines or markdown bullets, just the single lesson sentence.`;

        if (isVerbose) {
          console.log("\n[VERBOSE] Lesson Prompt:\n" + lessonPrompt);
        }

        try {
          const lessonText = await askGemini(lessonPrompt);
          const cleanLesson = lessonText.replace(/^[-*•]\s*/, "").split("\n")[0].trim();
          addLesson(cleanLesson);
          console.log(`Saved lesson to memory.md: "${cleanLesson}"`);
        } catch (err) {
          console.warn("Could not save lesson:", err.message || err);
        }
      }

      return;
    }

    lastObservedError = runResult.stderr.trim() || `Process exited with code ${runResult.exitCode}`;
    console.log(`Error observed:\n${lastObservedError}`);

    const currentCode = readFile(targetFilePath);
    const memoryContent = loadMemory();

    // THINK
    const prompt = `You are an automated JavaScript debugging agent.
The following JavaScript file encountered an error when executed with Node.js.

### Memory of Past Lessons:
${memoryContent}

### Current Code:
\`\`\`javascript
${currentCode}
\`\`\`

### Error Output:
${lastObservedError}

Provide a 1-2 sentence explanation of the bug, followed by the complete fixed JavaScript code inside ONE markdown code block (\`\`\`javascript ... \`\`\`).
Do not omit any part of the code.`;

    if (isVerbose) {
      console.log("\n[VERBOSE] Full Prompt Sent to Gemini:\n" + prompt);
    }

    let llmResponse = await askGemini(prompt);
    console.log(`Explanation:\n${llmResponse.split("```")[0].trim()}`);

    // ACT (with retry if code block missing)
    let fixedCode = extractCodeBlock(llmResponse);
    if (!fixedCode) {
      console.warn("Warning: No markdown code block in Gemini response. Retrying once...");
      const retryPrompt = `${prompt}\n\nIMPORTANT: You must include the full fixed code inside a markdown code block (\`\`\`javascript ... \`\`\`).`;
      llmResponse = await askGemini(retryPrompt);
      fixedCode = extractCodeBlock(llmResponse);

      if (!fixedCode) {
        console.error("Error: Failed to extract code block from Gemini response after retry.");
        process.exit(1);
      }
    }

    writeFile(targetFilePath, fixedCode + "\n");
  }

  console.error(`\nFailed to fix file after ${MAX_ITERATIONS} attempts.`);
  console.error(`Last observed error:\n${lastObservedError}`);
  process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Unexpected error in agent loop:", err);
    process.exit(1);
  });
}

module.exports = {
  extractCodeBlock,
  main,
};
