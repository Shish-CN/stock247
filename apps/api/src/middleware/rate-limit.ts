import type { MiddlewareHandler } from "hono";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests = 30, windowMs = 60_000): MiddlewareHandler {
  return async (context, next) => {
    const forwarded = context.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const key = forwarded || context.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    context.header("x-ratelimit-limit", String(maxRequests));
    context.header("x-ratelimit-remaining", String(Math.max(0, maxRequests - bucket.count)));
    if (bucket.count > maxRequests) return context.json({ error: "rate_limited" }, 429);
    await next();
  };
}
