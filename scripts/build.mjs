import { access } from "node:fs/promises";

const requiredFiles = [
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "api/markets.js",
  "api/quote.js",
  "api/health.js"
];

await Promise.all(requiredFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));
console.log("Static site and Vercel Functions are ready.");
