// ============================================================================
// Sogou Search Backend — HTML scraping (no API key needed)
// ============================================================================

import type { SearchBackend, SearchResult, SearchOptions } from "../types.js";
import { proxyFetch } from "../proxyFetch.js";

const SOGOU_URL = "https://www.sogou.com/web";

export const sogouBackend: SearchBackend = {
  name: "Sogou",

  async search(query: string, options: SearchOptions, signal: AbortSignal): Promise<SearchResult[]> {
    const limit = options.limit ?? 8;
    const url = `${SOGOU_URL}?query=${encodeURIComponent(query)}`;
    const resp = await proxyFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal,
    });

    if (!resp.ok) return [];
    const html = await resp.text();

    return parseSogouResults(html, limit);
  },
};

function parseSogouResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Sogou results in <div class="rb"> blocks within <div class="results">
  const blockRegex = /<div[^>]*class="[^"]*rb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*rb|\s*$)/gi;
  let match;

  while ((match = blockRegex.exec(html)) !== null) {
    if (results.length >= limit) break;
    const block = match[1];

    // Extract title and URL: <h3><a href="..." ...>title</a></h3>
    const linkMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*id="[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, "").trim();

    // Extract snippet
    const snippetMatch = block.match(/<p[^>]*class="[^"]*(?:str_info|space-txt|abstract)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      ?? block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
      : "";

    if (title && url) {
      results.push({ title, url, snippet: snippet.slice(0, 500) });
    }
  }

  return results;
}
