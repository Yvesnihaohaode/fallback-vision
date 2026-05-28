// ============================================================================
// fallback-vision — Core Type Definitions
// ============================================================================

// --- Model Capabilities ---

export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
  streaming: boolean;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  deprecatedAfter?: string;
}

// --- Provider ---

export interface ProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  models: ModelInfo[];
  wireFormat: "openai" | "anthropic";
  priority: number;
}

export interface ProviderInstance {
  config: ProviderConfig;
  isAvailable(): boolean;
  getModel(modelId: string): ModelInfo | undefined;
  hasVisionModel(): ModelInfo | undefined;
}

// --- Request Types ---

export type RequestFormat = "responses" | "chat-completions" | "anthropic";

export interface GatewayRequest {
  format: RequestFormat;
  model: string;
  stream: boolean;
  hasImages: boolean;
  hasTools: boolean;
  messages: unknown[];
  raw: unknown;
}

// --- Routing ---

export type RoutingStrategy = "cost" | "latency" | "quality" | "balanced";

export interface RoutingDecision {
  provider: ProviderInstance;
  model: ModelInfo;
  reason: string;
  fallbackFrom?: string;
}

// --- Stats ---

export interface RequestLog {
  id: string;
  timestamp: number;
  providerId: string;
  modelId: string;
  fallbackTriggered: boolean;
  fallbackFrom?: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  status: "success" | "error";
  error?: string;
}

export interface ProviderHealth {
  providerId: string;
  available: boolean;
  latencyMs: number;
  errorRate: number;
  lastCheck: number;
  consecutiveFailures: number;
}
