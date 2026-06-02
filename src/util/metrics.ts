import { RingBuffer } from "./ring-buffer.js";

export interface RequestRecord {
  ts: number;
  protocol: string;
  model: string;
  latencyMs: number;
  usedVision: boolean;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
}

interface Metrics {
  totalRequests: number;
  visionFallbacks: number;
  errors: number;
  startedAt: number;
  recent: readonly RequestRecord[];
}

let totalRequests = 0;
let visionFallbacks = 0;
let errors = 0;
const startedAt = Date.now();
const recent = new RingBuffer<RequestRecord>(50);

export function recordRequest(rec: Omit<RequestRecord, "ts">): void {
  totalRequests++;
  if (rec.usedVision) visionFallbacks++;
  if (!rec.ok) errors++;
  recent.push({ ...rec, ts: Date.now() });
}

export function getMetrics(): Metrics {
  return { totalRequests, visionFallbacks, errors, startedAt, recent: recent.toArray() };
}
