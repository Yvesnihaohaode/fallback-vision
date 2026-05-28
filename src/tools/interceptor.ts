// ============================================================================
// Tool Interceptor — handles web_search & web_fetch locally
// ============================================================================

import { log } from "../util/logger.js";

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
}

const LOCAL_TOOLS = new Set(["web_search", "web_fetch", "WebSearch"]);

export function hasLocalTools(tools?: Array<{ name?: string; function?: { name?: string } }>): boolean {
  if (!tools) return false;
  return tools.some((t) => LOCAL_TOOLS.has(t.name ?? t.function?.name ?? ""));
}

export function extractLocalToolCalls(response: unknown): ToolCall[] {
  const r = response as { content?: Array<{ type?: string; id?: string; name?: string; input?: unknown }> };
  if (!Array.isArray(r.content)) return [];
  return r.content
    .filter((b) => b.type === "tool_use" && b.name && LOCAL_TOOLS.has(b.name))
    .map((b) => ({ id: b.id ?? "", name: b.name ?? "", input: b.input ?? {} }));
}

export async function executeLocalTools(calls: ToolCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    try {
      const content = call.name === "web_search"
        ? await handleWebSearch(call.input)
        : call.name === "web_fetch"
          ? await handleWebFetch(call.input)
          : `Tool "${call.name}" is not available through this proxy.`;
      results.push({ tool_use_id: call.id, content });
    } catch (err) {
      results.push({ tool_use_id: call.id, content: `Error: ${(err as Error).message}` });
    }
  }
  return results;
}

// ============================================================================
// Web Search — SearXNG public instances + fallback
// ============================================================================

const SEARXNG_INSTANCES = [
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.be",
  "https://search.ononoki.org",
];

async function handleWebSearch(input: unknown): Promise<string> {
  const params = input as { query?: string; num_results?: number };
  const query = params.query;
  if (!query) return "Error: no search query provided";
  const numResults = params.num_results ?? 5;
  log.info(`[tool:web_search] "${query}" (max ${numResults} results)`);

  // Try SearXNG instances
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      const res = await fetch(url, {
        headers: { "User-Agent": "FallbackVision/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
      if (data.results && data.results.length > 0) {
        const results = data.results.slice(0, numResults).map((r, i) =>
          `${i + 1}. **${r.title ?? "Untitled"}**\n   ${r.url ?? ""}\n   ${r.content ?? ""}`
        );
        log.info(`[tool:web_search] SearXNG success via ${instance}, ${data.results.length} results`);
        return results.join("\n\n");
      }
    } catch {
      continue;
    }
  }

  // Fallback: DuckDuckGo instant answer
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as { AbstractText?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
    const results: string[] = [];
    if (data.AbstractText) results.push(`Summary: ${data.AbstractText}`);
    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics.slice(0, numResults)) {
        if (t.Text) results.push(`- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);
      }
    }
    if (results.length > 0) return results.join("\n");
  } catch {
    // continue to error
  }

  return `Search failed: all search backends unreachable for "${query}"`;
}

// ============================================================================
// Web Fetch — fetch a URL and return text content
// ============================================================================

async function handleWebFetch(input: unknown): Promise<string> {
  const params = input as { url?: string; max_length?: number };
  const url = params.url;
  if (!url) return "Error: no URL provided";
  const maxLength = params.max_length ?? 5000;
  log.info(`[tool:web_fetch] ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `HTTP ${res.status}: ${res.statusText}`;
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (contentType.includes("text/html")) {
      return text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
    }
    return text.slice(0, maxLength);
  } catch (err) {
    return `Fetch error: ${(err as Error).message}`;
  }
}
