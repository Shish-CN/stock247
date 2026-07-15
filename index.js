import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import healthHandler from "./api/health.js";
import marketsHandler from "./api/markets.js";
import quoteHandler from "./api/quote.js";

const staticFiles = new Map([
  ["/", ["./public/index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["./public/index.html", "text/html; charset=utf-8"]],
  ["/client.js", ["./public/client.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["./public/styles.css", "text/css; charset=utf-8"]]
]);

async function serveStatic(response, relativePath, contentType, method) {
  try {
    const body = await readFile(new URL(relativePath, import.meta.url));
    response.statusCode = 200;
    response.setHeader("content-type", contentType);
    response.setHeader("cache-control", relativePath.endsWith("index.html") ? "no-cache" : "public, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    if (method === "HEAD") return response.end();
    return response.end(body);
  } catch {
    response.statusCode = 404;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    return response.end("Not found");
  }
}

export default async function handler(request, response) {
  const method = request.method || "GET";
  const url = new URL(request.url || "/", "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/api/health" || pathname === "/health") {
    return healthHandler(request, response);
  }
  if (pathname === "/api/markets" || pathname === "/api/top" || pathname === "/markets") {
    return marketsHandler(request, response);
  }
  if (pathname === "/api/quote") {
    return quoteHandler(request, response);
  }

  const staticFile = staticFiles.get(pathname);
  if (staticFile && (method === "GET" || method === "HEAD")) {
    return serveStatic(response, staticFile[0], staticFile[1], method);
  }

  if ((method === "GET" || method === "HEAD") && !pathname.includes(".")) {
    return serveStatic(response, "./public/index.html", "text/html; charset=utf-8", method);
  }

  response.statusCode = method === "GET" || method === "HEAD" ? 404 : 405;
  response.setHeader("content-type", "application/json; charset=utf-8");
  return response.end(JSON.stringify({ ok: false, error: response.statusCode === 404 ? "not_found" : "method_not_allowed" }));
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error) => {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ ok: false, error: "internal_error", reason: error instanceof Error ? error.message : "unknown_error" }));
    });
  }).listen(port, () => {
    console.log(`stock247 listening on http://localhost:${port}`);
  });
}
