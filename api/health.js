import { jsonResponse } from "../lib/hyperliquid.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    return jsonResponse(response, 405, { ok: false, error: "method_not_allowed" });
  }

  return jsonResponse(response, 200, {
    ok: true,
    service: "stock247-tradexyz",
    timestamp: new Date().toISOString()
  });
}
