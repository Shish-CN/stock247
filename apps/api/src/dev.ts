import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
serve({ fetch: createApp({ config }).fetch, port: config.PORT });
console.warn(`Stock247 API listening on http://localhost:${config.PORT}`);
