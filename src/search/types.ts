// ============================================================================
// Hybrid Search Types — DeepSeek-style multi-backend search
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOptions {
  limit?: number;
  freshness?: "day" | "week" | "month" | "year";
}

export interface SearchBackend {
  name: string;
  search(query: string, options: SearchOptions, signal: AbortSignal): Promise<SearchResult[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  backend: string;
  latencyMs: number;
}
