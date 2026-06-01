// ============================================================================
// Upstream HTTP Client — talks to MiMo, DeepSeek, OpenAI, Anthropic, etc.
//
// Supports two wire formats:
// - "openai" (default): POST to {baseUrl}/chat/completions, Bearer auth
// - "anthropic": POST to {baseUrl}/messages, x-api-key auth
// ============================================================================

import { log } from "../util/logger.js";

export type WireFormat = "openai" | "anthropic";

function resolveUrl(baseUrl: string, wireFormat: WireFormat): string {
  if (wireFormat === "anthropic") return `${baseUrl}/messages`;
  return `${baseUrl}/chat/completions`;
}

function resolveHeaders(apiKey: string, wireFormat: WireFormat): Record<string, string> {
  if (wireFormat === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function callUpstreamChat(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  wireFormat: WireFormat = "openai",
): Promise<Record<string, unknown>> {
  const url = resolveUrl(baseUrl, wireFormat);

  log.debug("upstream request", {
    url,
    wireFormat,
    model: (body as Record<string, unknown>).model,
    stream: (body as Record<string, unknown>).stream,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: resolveHeaders(apiKey, wireFormat),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`upstream ${resp.status}: ${text.slice(0, 500)}`);
  }

  return (await resp.json()) as Record<string, unknown>;
}

/**
 * Streaming version: returns an async generator of raw SSE text chunks
 * from the upstream provider. Each yield may contain one or more complete
 * or partial lines.
 */
export async function* callUpstreamChatStreaming(
  baseUrl: string,
  apiKey: string,
  body: unknown,
  wireFormat: WireFormat = "openai",
): AsyncGenerator<string, void, unknown> {
  const url = resolveUrl(baseUrl, wireFormat);

  log.debug("upstream streaming request", {
    url,
    wireFormat,
    model: (body as Record<string, unknown>).model,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: resolveHeaders(apiKey, wireFormat),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`upstream ${resp.status}: ${text.slice(0, 500)}`);
  }

  if (!resp.body) {
    throw new Error("upstream returned no body for streaming request");
  }

  // Read the SSE stream using Node.js ReadableStream
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
