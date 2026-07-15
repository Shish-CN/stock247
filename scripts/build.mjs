import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "app.js",
  "index.js",
  "public/index.html",
  "public/client.js",
  "public/styles.css",
  "api/markets.js",
  "api/quote.js",
  "api/health.js"
];

await Promise.all(requiredFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));

const browserSource = await readFile(new URL("../public/client.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
if (!browserSource.includes("document.querySelector")) {
  throw new Error("Browser client is missing its DOM bootstrap");
}
if (/\bdocument\b/.test(serverSource) || /\bwindow\b/.test(serverSource)) {
  throw new Error("Server entrypoint must not reference browser globals");
}

await import(new URL("../app.js", import.meta.url));
console.log("Static site and server-safe Vercel entrypoints are ready.");
