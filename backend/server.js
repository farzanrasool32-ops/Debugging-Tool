const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const filesHandler = require("./api/files");
const memoryHandler = require("./api/memory");
const debugStreamHandler = require("./api/debug-stream");

const PORT = process.env.PORT || 3001;

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enhance res with status and json helpers similar to Express
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.writeHead(res.statusCode || 200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  };

  if (pathname === "/api/files" && req.method === "GET") {
    return filesHandler(req, res);
  }

  if (pathname === "/api/memory" && req.method === "GET") {
    return memoryHandler(req, res);
  }

  if (pathname === "/api/debug-stream" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      return debugStreamHandler(req, res);
    });
    return;
  }

  // Health check
  if (pathname === "/" || pathname === "/health") {
    return res.json({ status: "ok", service: "Debugging-Tool Node.js Backend", port: PORT });
  }

  res.status(404).json({ error: "Route not found", pathname });
});

server.listen(PORT, () => {
  console.log(`Node.js Backend Server running on http://localhost:${PORT}`);
  console.log(`- Health Check:  http://localhost:${PORT}/health`);
  console.log(`- Files API:     http://localhost:${PORT}/api/files`);
  console.log(`- Memory API:    http://localhost:${PORT}/api/memory`);
  console.log(`- Debug Stream:  http://localhost:${PORT}/api/debug-stream`);
});

module.exports = server;
