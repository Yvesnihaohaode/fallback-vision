// ============================================================================
// Hybrid Search Orchestrator — DeepSeek-style multi-backend parallel search
//
// Runs all available backends in parallel. First successful response wins.
// Timeout per backend: 8s. Overall timeout: 12s.
// Backends tried in parallel — the fastest to return results "wins" the race.
// ============================================================================

import { log } from "../util/logger.js";
import { googleBackend } from "./backends/google.js";
import { bingBackend } from "./backends/bing.js";
import { sogouBackend } from "./backends/sogou.js";
import { braveBackend } from "./backends/brave.js";
import type { SearchBackend, SearchResponse, SearchOptions } from "./types.js";

// Bing first (reliable direct connection for Chinese queries).
// Google/Brave/Sogou as fallbacks via proxy when available.
const BACKENDS: SearchBackend[] = [bingBackend, sogouBackend, googleBackend, braveBackend];

const PER_BACKEND_TIMEOUT_MS = 8000;
const OVERALL_TIMEOUT_MS = 12000;
const DEFAULT_LIMIT = 8;

export async function hybridSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const start = Date.now();
  log.info(`[hybrid-search] "${query.slice(0, 80)}" across ${BACKENDS.length} backends${options.freshness ? ` (freshness: ${options.freshness})` : ""}`);

  const controller = new AbortController();
  const overallTimer = setTimeout(() => {
    log.warn("[hybrid-search] overall timeout, aborting all");
    controller.abort();
  }, OVERALL_TIMEOUT_MS);

  // Race all backends — first to return non-empty results wins
  const promises = BACKENDS.map((backend) =>
    searchWithTimeout(backend, query, options, PER_BACKEND_TIMEOUT_MS, controller.signal)
  );

  try {
    // Use Promise.any — resolves with the first successful result
    const result = await Promise.any(promises);
    clearTimeout(overallTimer);
    controller.abort(); // Cancel remaining backends

    const elapsed = Date.now() - start;
    log.info(`[hybrid-search] ${result.backend} returned ${result.results.length} results in ${elapsed}ms`);

    return { ...result, latencyMs: elapsed };
  } catch {
    clearTimeout(overallTimer);
    controller.abort(); // Clean up any lingering requests

    // All backends failed — use original promises to report errors
    const settled = await Promise.allSettled(promises);

    const failures = settled
      .filter((s: PromiseSettledResult<SearchResponse>) => s.status === "rejected")
      .map((s: PromiseRejectedResult) => s.reason?.message ?? "unknown");

    log.warn(`[hybrid-search] all backends failed: ${failures.join("; ")}`);

    return {
      results: [],
      backend: "none",
      latencyMs: Date.now() - start,
    };
  }
}

async function searchWithTimeout(
  backend: SearchBackend,
  query: string,
  options: SearchOptions,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<SearchResponse> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const backendController = new AbortController();
  const timer = setTimeout(() => backendController.abort(), timeoutMs);

  // Combine external signal with backend-specific timeout
  const combinedSignal = combineSignals(signal, backendController.signal);

  try {
    const start = Date.now();
    const results = await backend.search(query, options, combinedSignal);
    clearTimeout(timer);

    if (results.length === 0) {
      throw new Error(`${backend.name}: no results`);
    }

    return {
      results: results.slice(0, limit),
      backend: backend.name,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timer);
    if (combinedSignal.aborted && !signal.aborted) {
      throw new Error(`${backend.name}: timeout`);
    }
    throw err;
  }
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted || b.aborted) return AbortSignal.abort("already aborted");

  const controller = new AbortController();

  const onAbort = () => {
    controller.abort(a.aborted ? a.reason : b.reason);
  };

  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });

  return controller.signal;
}
