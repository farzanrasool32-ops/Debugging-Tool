import * as fs from "fs";
import { spawnSync } from "child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Reads and returns the content of the file at the given path.
 */
export function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8");
}

/**
 * Writes the given content to the file at the specified path.
 */
export function writeFile(path: string, content: string): void {
  fs.writeFileSync(path, content, "utf-8");
}

/**
 * Runs a JavaScript file using Node.js with a 5-second timeout.
 * Returns stdout, stderr, exitCode, and timedOut flag.
 */
export function runCode(path: string): RunResult {
  const result = spawnSync("node", [path], {
    timeout: 5000,
    encoding: "utf-8",
  });

  const timedOut = Boolean(
    result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
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
