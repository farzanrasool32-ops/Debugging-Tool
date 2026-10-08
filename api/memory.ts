import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as fs from "fs";
import * as path from "path";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const memoryPath = path.resolve(process.cwd(), "memory.md");
  let content = "# Agent Memory\n";

  if (fs.existsSync(memoryPath)) {
    try {
      content = fs.readFileSync(memoryPath, "utf-8");
    } catch {}
  }

  const lessons = content
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().replace(/^- /, ""));

  return res.status(200).json({ raw: content, lessons });
}
