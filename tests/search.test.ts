import { describe, expect, it } from "vitest";

// These tests verify the hybrid search system (Bing/Sogou/Brave).
// Network-dependent tests are skipped by default — enable for integration validation.

describe("Hybrid search (integration)", () => {
  it.skip("Bing search returns results", async () => {
    const { bingBackend } = await import("../src/search/backends/bing.js");
    const results = await bingBackend.search("test query", { limit: 3 }, AbortSignal.timeout(8000));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("url");
  });

  it.skip("Sogou search returns results", async () => {
    const { sogouBackend } = await import("../src/search/backends/sogou.js");
    const results = await sogouBackend.search("test query", { limit: 3 }, AbortSignal.timeout(8000));
    expect(results.length).toBeGreaterThan(0);
  });

  it.skip("Brave search returns results (requires BRAVE_SEARCH_API_KEY)", async () => {
    const { braveBackend } = await import("../src/search/backends/brave.js");
    const results = await braveBackend.search("test query", { limit: 3 }, AbortSignal.timeout(8000));
    expect(results.length).toBeGreaterThan(0);
  });

  it.skip("hybridSearch races backends", async () => {
    const { hybridSearch } = await import("../src/search/hybrid.js");
    const resp = await hybridSearch("test query");
    expect(resp.results.length).toBeGreaterThan(0);
    expect(resp.backend).toBeTruthy();
    expect(resp.latencyMs).toBeGreaterThan(0);
  });

  it.skip("hybridSearch with freshness filter", async () => {
    const { hybridSearch } = await import("../src/search/hybrid.js");
    const resp = await hybridSearch("DeepSeek latest model", { freshness: "month" });
    expect(resp.results.length).toBeGreaterThan(0);
  });
});
