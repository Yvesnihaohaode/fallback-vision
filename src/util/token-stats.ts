import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

interface DailyData {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

interface ModelData {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  daily: Record<string, DailyData>;
}

export interface TokenStats {
  models: Record<string, ModelData>;
}

const FILE_PATH = join(homedir(), ".fallback-vision", "token-stats.json");
const MAX_DAYS = 90;

let stats: TokenStats = { models: {} };
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function loadTokenStats(): void {
  try {
    if (existsSync(FILE_PATH)) {
      const raw = readFileSync(FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as TokenStats;
      if (parsed && typeof parsed.models === "object") {
        stats = parsed;
      }
    }
  } catch {
    stats = { models: {} };
  }
}

function saveToDisk(): void {
  try {
    const dir = dirname(FILE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = FILE_PATH + ".tmp";
    writeFileSync(tmp, JSON.stringify(stats, null, 2));
    writeFileSync(FILE_PATH, JSON.stringify(stats)); // atomic-ish: compact final
    try { require("node:fs").unlinkSync(tmp); } catch { /* ignore */ }
  } catch { /* best effort */ }
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToDisk();
  }, 10_000);
}

function pruneOldDays(model: ModelData): void {
  const keys = Object.keys(model.daily).sort();
  while (keys.length > MAX_DAYS) {
    delete model.daily[keys.shift()!];
  }
}

export function recordTokenUsage(model: string, inputTokens: number, outputTokens: number): void {
  if (!model || (inputTokens === 0 && outputTokens === 0)) return;

  const today = new Date().toISOString().slice(0, 10);

  if (!stats.models[model]) {
    stats.models[model] = { requests: 0, inputTokens: 0, outputTokens: 0, daily: {} };
  }

  const m = stats.models[model];
  m.requests++;
  m.inputTokens += inputTokens;
  m.outputTokens += outputTokens;

  if (!m.daily[today]) {
    m.daily[today] = { requests: 0, inputTokens: 0, outputTokens: 0 };
  }
  const d = m.daily[today];
  d.requests++;
  d.inputTokens += inputTokens;
  d.outputTokens += outputTokens;

  pruneOldDays(m);
  scheduleSave();
}

export function getTokenStats(): TokenStats {
  return stats;
}

// Flush on exit
process.on("beforeExit", saveToDisk);
process.on("SIGINT", () => { saveToDisk(); process.exit(0); });
process.on("SIGTERM", () => { saveToDisk(); process.exit(0); });
