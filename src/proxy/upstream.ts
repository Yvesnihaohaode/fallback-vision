import { log, redactKey } from "../util/logger.js";
import type { ModelInfo } from "../types.js";

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
  model: ModelInfo;
  userAgent: string;
  timeoutMs?: number;
}

export class UpstreamError extends Error {
  status: number;
  bodySnippet?: string;

  constructor(status: number, message: string, bodySnippet?: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

/**
 * Forward a request to an upstream AI provider.
 * Default timeout: 60s. Tool interception rounds use 30s.
 */
export async function callUpstream(
  cfg: UpstreamConfig,
  body: unknown,
  path: string = "/chat/completions"
): Promise<Response> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}${path}`;
  const timeoutMs = cfg.timeoutMs ?? 60_000;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": cfg.userAgent,
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  log.debug(`upstream POST ${url}`, {
    model: cfg.model.id,
    apiKey: redactKey(cfg.apiKey),
    timeoutMs,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const snippet = await res.text().catch(() => "");
    throw new UpstreamError(
      res.status,
      `upstream returned ${res.status}: ${snippet.slice(0, 200)}`,
      snippet.slice(0, 800)
    );
  }

  return res;
}
