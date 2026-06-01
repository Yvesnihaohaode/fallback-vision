// ============================================================================
// Google Search Backend — HTML scraping via proxy
//
// Google provides the best global search quality. Must go through proxy
// since Google is blocked in China. Falls back gracefully to empty results
// on CAPTCHA or blocking (other backends will take over).
// ============================================================================

import type { SearchBackend, SearchResult, SearchOptions } from "../types.js";
import { proxyFetch } from "../proxyFetch.js";

const GOOGLE_URL = "https://www.google.com/search";

// Domains that produce low-quality dictionary/encyclopedia results
const garbageDomains = [
  "baike.baidu.com/item",
  "iciba.com",
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

export const googleBackend: SearchBackend = {
  name: "Google",

  async search(query: string, options: SearchOptions, signal: AbortSignal): Promise<SearchResult[]> {
    const limit = options.limit ?? 8;
    // udm=14 → "Web" tab (no AI overviews, no news, no images — cleaner parsing)
    // tbs=qdr:M → restrict to past month for freshness
    let tbs = "";
    if (options.freshness) {
      const tbsMap: Record<string, string> = { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
      tbs = `&tbs=${tbsMap[options.freshness]}`;
    }
    const url = `${GOOGLE_URL}?q=${encodeURIComponent(query)}&udm=14&num=${Math.min(limit + 5, 20)}${tbs}`;
    const resp = await proxyFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal,
    }, { proxy: true });

    if (!resp.ok) return [];
    const html = await resp.text();

    // Google may return a CAPTCHA page
    if (html.includes("captcha") || html.includes("g-recaptcha") || html.length < 5000) {
      return [];
    }

    return parseGoogleResults(html, limit);
  },
};

function parseGoogleResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Google organic results use <h3> for titles. Each result block has an
  // <a> tag with href="/url?q=REAL_URL" pointing to the destination.
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;

  while ((match = h3Regex.exec(html)) !== null) {
    if (results.length >= limit) break;

    const title = match[1].replace(/<[^>]+>/g, "").trim();
    if (!title || title.length < 2) continue;

    // Search backwards from h3 to find the <a> with the real URL
    const before = html.slice(Math.max(0, match.index - 800), match.index);
    const urlMatch = before.match(/<a[^>]*href="\/url\?q=(https?:\/\/[^"&]+)/);
    if (!urlMatch) continue;

    const url = decodeURIComponent(urlMatch[1]);

    if (garbageDomains.some((d) => url.includes(d))) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    // Search forward from h3 to find the snippet
    const after = html.slice(match.index, match.index + 3000);
    const snippetMatch = after.match(/<span[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/span>/)
      ?? after.match(/<div[^>]*data-sncf[^>]*>([\s\S]*?)<\/div>/)
      ?? after.match(/<div[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/div>/);

    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").trim()
      : "";

    results.push({ title, url, snippet: snippet.slice(0, 500) });
  }

  return results;
}
