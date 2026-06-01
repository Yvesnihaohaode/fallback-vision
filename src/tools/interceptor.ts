// ============================================================================
// Tool Interceptor — handles web_search & web_fetch locally
// ============================================================================

import { log } from "../util/logger.js";
import { hybridSearch } from "../search/index.js";
import { proxyFetch } from "../search/proxyFetch.js";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

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
      const name = call.name.toLowerCase();
      const content = name === "web_search" || name === "websearch"
        ? await handleWebSearch(call.input)
        : name === "web_fetch"
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
// Web Search — DeepSeek-style hybrid multi-backend search
// ============================================================================

async function handleWebSearch(input: unknown): Promise<string> {
  const params = input as { query?: string; num_results?: number; freshness?: "day" | "week" | "month" | "year" };
  const query = params.query;
  if (!query) return "Error: no search query provided";
  const numResults = params.num_results ?? 5;
  log.info(`[tool:web_search] "${query}" (max ${numResults}${params.freshness ? `, freshness: ${params.freshness}` : ""})`);

  const response = await hybridSearch(query, { limit: numResults, freshness: params.freshness });

  if (response.results.length > 0) {
    return response.results
      .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
      .join("\n\n");
  }

  return `Search failed: all backends unreachable for "${query}" (${response.backend})`;
}

// ============================================================================
// Web Fetch — fetch a URL and extract readable content
// ============================================================================

const FETCH_TIMEOUT_MS = 15000;
const FETCH_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/**
 * Fetch a URL and extract readable content using Mozilla's Readability
 * (same algorithm as Firefox Reader Mode). Falls back to basic HTML
 * stripping if Readability can't parse the page.
 */
export async function fetchWebContent(url: string, maxLength = 8000): Promise<string> {
  log.info(`[web_fetch] ${url}`);

  const res = await proxyFetch(url, {
    headers: {
      "User-Agent": FETCH_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }, { proxy: true });

  if (!res.ok) return `HTTP ${res.status}: ${res.statusText}`;

  const contentType = res.headers.get("content-type") ?? "";
  const html = await res.text();

  if (!contentType.includes("text/html")) {
    return html.slice(0, maxLength);
  }

  // Try Readability first
  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const article = reader.parse();
    if (article?.textContent) {
      return article.textContent.replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
    }
  } catch {
    // Fall through to basic extraction
  }

  // Fallback: basic HTML stripping
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function handleWebFetch(input: unknown): Promise<string> {
  const params = input as { url?: string; max_length?: number };
  const url = params.url;
  if (!url) return "Error: no URL provided";
  return fetchWebContent(url, params.max_length ?? 5000);
}
