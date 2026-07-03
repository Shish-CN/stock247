import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getQuote, getTopMarkets } from "./lib/market-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 5174);
const QUOTE_CACHE_CONTROL = "s-maxage=5, stale-while-revalidate=30";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

function json(res, status, payload, { cacheControl = "no-store" } = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": cacheControl,
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

function errorPayload(error) {
  return {
    ok: false,
    error: error.code || (error.status === 404 ? "not_found" : "quote_unavailable"),
    message: error.message || "行情服务暂时不可用。",
    ...(error.providers ? { providers: error.providers } : {})
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const safePath = path.normalize(rawPath).replace(/^\/+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME_TYPES.get(extension) || "application/octet-stream",
      "cache-control": extension === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(body);
  } catch {
    const body = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(body);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      res.end();
      return;
    }

    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, updatedAt: new Date().toISOString() });
      return;
    }

    if (url.pathname === "/api/top") {
      json(res, 200, await getTopMarkets());
      return;
    }

    if (url.pathname === "/api/quote") {
      try {
        json(res, 200, await getQuote(url.searchParams.get("symbol")), {
          cacheControl: QUOTE_CACHE_CONTROL
        });
      } catch (error) {
        json(res, error.status || 502, errorPayload(error), {
          cacheControl: QUOTE_CACHE_CONTROL
        });
      }
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    json(res, error.status || 502, errorPayload(error));
  }
});

server.listen(PORT, () => {
  console.log(`Stock contract dashboard listening on http://localhost:${PORT}`);
});
