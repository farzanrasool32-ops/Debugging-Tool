const fs = require("fs");
const path = require("path");

function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status ? res.status(204).end() : (res.statusCode = 204, res.end());
  }

  const memoryPath = path.resolve(__dirname, "../memory.md");
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

  const payload = { raw: content, lessons };
  if (res.json) {
    return res.status(200).json(payload);
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

module.exports = handler;
module.exports.default = handler;
