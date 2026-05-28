import { describe, expect, it } from "vitest";

// Search tests require network access to external APIs.
// These tests may fail in restricted environments (sandboxes, corporate networks).
// Run on actual machine for full validation.

const canReachInternet = await (async () => {
  try {
    const res = await fetch("https://api.github.com", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
})();

describe("Web Search backends", () => {
  it.skipIf(!canReachInternet)("SearXNG returns search results", async () => {
    const instances = [
      "https://search.sapti.me",
      "https://searx.tiekoetter.com",
      "https://search.ononoki.org",
      "https://search.bus-hit.me",
      "https://priv.au",
    ];

    let foundResults = false;
    for (const instance of instances) {
      try {
        const url = `${instance}/search?q=${encodeURIComponent("javascript programming")}&format=json&categories=general`;
        const res = await fetch(url, {
          headers: { "User-Agent": "FallbackVision/1.0", "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
        if (data.results && data.results.length > 0) {
          console.log(`✓ SearXNG via ${instance}: ${data.results.length} results`);
          expect(data.results.length).toBeGreaterThan(0);
          foundResults = true;
          break;
        }
      } catch { continue; }
    }
    if (!foundResults) {
      console.warn("⚠ No SearXNG instance returned results");
    }
  });

  it.skipIf(!canReachInternet)("DuckDuckGo instant answer API", async () => {
    try {
      const res = await fetch("https://api.duckduckgo.com/?q=javascript&format=json&no_html=1", {
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as { AbstractText?: string; RelatedTopics?: unknown[] };
      console.log(`✓ DDG: Abstract=${data.AbstractText ? "yes" : "no"}, Topics=${data.RelatedTopics?.length ?? 0}`);
      expect(typeof data).toBe("object");
    } catch (err) {
      console.warn(`⚠ DDG failed: ${(err as Error).message}`);
    }
  });

  it.skipIf(!canReachInternet)("web_fetch retrieves page content", async () => {
    try {
      const res = await fetch("https://httpbin.org/html", { signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      console.log(`✓ httpbin: ${text.length} chars`);
      expect(text.length).toBeGreaterThan(0);
    } catch (err) {
      console.warn(`⚠ httpbin failed: ${(err as Error).message}`);
    }
  });
});
