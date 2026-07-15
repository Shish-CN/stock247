export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "http_error" | "invalid_payload",
    public readonly status?: number
  ) {
    super(message);
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6500
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new UpstreamError(`Upstream responded with HTTP ${response.status}`, "http_error", response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UpstreamError(`Upstream timed out after ${timeoutMs}ms`, "timeout");
    }
    throw new UpstreamError(error instanceof Error ? error.message : "Unknown upstream error", "http_error");
  } finally {
    clearTimeout(timeout);
  }
}
