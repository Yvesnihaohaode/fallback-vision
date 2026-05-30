// ============================================================================
// Upstream HTTP Client — talks to MiMo, DeepSeek, OpenAI, etc.
// ============================================================================

import { log } from "../util/logger.js";

export async function callUpstreamChat(
  baseUrl: string,
  apiKey: string,
  body: unknown
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}/chat/completions`;

  log.debug("upstream request", {
    url,
    model: (body as Record<string, unknown>).model,
    stream: (body as Record<string, unknown>).stream,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
): AsyncGenerator<string, void, unknown> {
  const url = `${baseUrl}/chat/completions`;

  log.debug("upstream streaming request", {
    url,
    model: (body as Record<string, unknown>).model,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
