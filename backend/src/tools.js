const fs = require("fs");
const { spawnSync } = require("child_process");

/**
 * Reads and returns the content of the file at the given path.
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Writes the given content to the file at the specified path.
 */
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Runs a JavaScript file using Node.js with a 5-second timeout.
 * Returns stdout, stderr, exitCode, and timedOut flag.
 */
function runCode(filePath) {
  const result = spawnSync("node", [filePath], {
    timeout: 5000,
    encoding: "utf-8",
  });

  const timedOut = Boolean(
    result.error && result.error.code === "ETIMEDOUT"
  );

  const stdout = result.stdout || "";
  let stderr = result.stderr || "";

  if (timedOut && !stderr) {
    stderr = "Execution timed out after 5000ms";
  } else if (result.error && !timedOut && !stderr) {
    stderr = result.error.message;
  }

  const exitCode = result.status !== null ? result.status : (timedOut ? 1 : 1);

  return {
    stdout,
    stderr,
    exitCode,
    timedOut,
  };
}

module.exports = {
  readFile,
  writeFile,
  runCode,
};
