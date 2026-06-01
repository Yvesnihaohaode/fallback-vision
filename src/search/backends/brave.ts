// ============================================================================
// Brave Search API — same backend Anthropic uses for Claude's web_search
// Requires BRAVE_SEARCH_API_KEY env var. Paid API ($5/mo). Skipped when unset.
// ============================================================================

import type { SearchBackend, SearchResult, SearchOptions } from "../types.js";
import { proxyFetch } from "../proxyFetch.js";

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

function getApiKey(): string | null {
  return process.env.BRAVE_SEARCH_API_KEY ?? null;
}

export const braveBackend: SearchBackend = {
  name: "Brave",

  async search(query: string, options: SearchOptions, signal: AbortSignal): Promise<SearchResult[]> {
    const apiKey = getApiKey();
    if (!apiKey) return [];
    const limit = options.limit ?? 8;

    // pd=past day, pw=past week, pm=past month, py=past year
    let freshness = "";
    if (options.freshness) {
      const fMap: Record<string, string> = { day: "pd", week: "pw", month: "pm", year: "py" };
      freshness = `&freshness=${fMap[options.freshness]}`;
    }
    const url = `${BRAVE_API}?q=${encodeURIComponent(query)}&count=${Math.min(limit, 20)}${freshness}`;
    const resp = await proxyFetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal,
    }, { proxy: true }); // Brave is blocked in China, must use proxy

    if (!resp.ok) return [];
    const data = await resp.json() as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };

    return (data.web?.results ?? []).slice(0, limit).map((r) => ({
      title: r.title ?? "Untitled",
      url: r.url ?? "",
      snippet: r.description ?? "",
    }));
  },
};
