// ============================================================================
// Bing Search Backend — HTML scraping (no API key needed)
// ============================================================================

import type { SearchBackend, SearchResult, SearchOptions } from "../types.js";
import { proxyFetch } from "../proxyFetch.js";

const BING_URL = "https://www.bing.com/search";

export const bingBackend: SearchBackend = {
  name: "Bing",

  async search(query: string, options: SearchOptions, signal: AbortSignal): Promise<SearchResult[]> {
    const limit = options.limit ?? 8;
    // ex1="ez5" → past month freshness filter
    let freshness = "";
    if (options.freshness) {
      const fMap: Record<string, string> = { day: "ez1", week: "ez2", month: "ez5", year: "ez4" };
      freshness = `&filters=ex1%3a%22${fMap[options.freshness]}%22`;
    }
    const url = `${BING_URL}?q=${encodeURIComponent(query)}&setlang=zh-cn${freshness}`;
    // Direct connection — Bing from China gives good Chinese results.
    // Proxy (especially Korean nodes) returns wrong-region results.
    const resp = await proxyFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal,
    });

    if (!resp.ok) return [];
    const html = await resp.text();

    return parseBingResults(html, limit);
  },
};

/**
 * Decode a base64-encoded URL from Bing's redirect link parameter.
 * Bing wraps destination URLs as: /ck/a?!...&u=a1BASE64_URL&ntb=1
 * The "a1" prefix is a Bing-specific version marker — strip before decoding.
 */
function decodeBingUrl(encoded: string): string {
  try {
    // Strip Bing's "a1" prefix (version/length marker)
    const body = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
    // Add padding if needed (base64 requires length % 4 === 0)
    const padded = body.length % 4 ? body + "=".repeat(4 - (body.length % 4)) : body;
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function parseBingResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Known dictionary/encyclopedia domains that produce low-quality search results
  const garbageDomains = [
    "baike.baidu.com/item",
    "iciba.com/word",
    "hanyu.baidu.com",
    "zdic.net",
    "dict.cn",
    "chinesehelper.cn",
    "dictionary.cambridge.org",
    "merriam-webster.com/dictionary",
    "oxfordlearnersdictionaries.com",
    "collinsdictionary.com",
    "vocabulary.com/dictionary",
    "global.bing.com/dict",
    "cn.bing.com/dict",
  ];

  // Bing results are in <li class="b_algo"> blocks
  const algoRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  const matches = html.matchAll(algoRegex);

  for (const m of matches) {
    if (results.length >= limit) break;
    const block = m[1];

    // International Bing (via proxy) uses redirect URLs with the real
    // destination base64-encoded in the "u" parameter. HTML entities
    // (like &amp;) are common — normalize before matching.
    //   href="https://www.bing.com/ck/a?!...&u=BASE64_URL&..."
    // China Bing uses direct URLs: href="https://example.com/..."
    const normalizedBlock = block.replace(/&amp;/g, "&");
    const redirectMatch = normalizedBlock.match(/href="https?:\/\/www\.bing\.com\/ck\/a\?[^"]*&u=([^"&]+)/);
    let url: string;
    if (redirectMatch) {
      url = decodeBingUrl(redirectMatch[1]);
      if (!url || !url.startsWith("http")) continue;
    } else {
      // Fallback: direct URL (China Bing format)
      const directMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!directMatch) continue;
      url = directMatch[1];
    }

    // Extract title from <h2><a ...>title</a></h2>
    const h2Match = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    if (!h2Match) continue;
    const title = h2Match[1].replace(/<[^>]+>/g, "").trim();
    if (!title || title.length < 2) continue;

    // Skip garbage domains
    if (garbageDomains.some((d) => url.includes(d))) continue;

    // Extract snippet from <p> or <div class="b_caption">
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
      ?? block.match(/<div class="b_caption"[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
      : "";

    if (title && url) {
      results.push({ title, url, snippet: snippet.slice(0, 500) });
    }
  }

  return results;
}
