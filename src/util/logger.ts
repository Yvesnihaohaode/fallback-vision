import { RingBuffer } from "./ring-buffer.js";
import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  extra?: string;
}

let verbose = false;
const logBuffer = new RingBuffer<LogEntry>(200);
const FV_DIR = join(homedir(), ".fallback-vision");
const LOG_FILE = join(FV_DIR, "server.log");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB rotation

function ensureLogDir(): void {
  if (!existsSync(FV_DIR)) mkdirSync(FV_DIR, { recursive: true });
}

function rotateLog(): void {
  try {
    if (!existsSync(LOG_FILE)) return;
    const stat = statSync(LOG_FILE);
    if (stat.size > MAX_LOG_SIZE) {
      const bak = LOG_FILE + ".old";
      if (existsSync(bak)) {
        // keep only one old log
      }
      renameSync(LOG_FILE, bak);
    }
  } catch {}
}

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function getRecentLogs(): readonly LogEntry[] {
  return logBuffer.toArray();
}

function emit(level: Level, msg: string, extra?: Record<string, unknown>): void {
  if (level === "debug" && !verbose) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${level.toUpperCase()}`;
  const line = extra
    ? `${prefix} ${msg} ${JSON.stringify(extra)}`
    : `${prefix} ${msg}`;

  // Always to stderr (for foreground debugging)
  console.error(line);

  // Always to file (for background debugging)
  try {
    ensureLogDir();
    rotateLog();
    appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch {}

  logBuffer.push({ ts, level, msg, extra: extra ? JSON.stringify(extra) : undefined });
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
};

export function redactKey(k: string | undefined | null): string {
  if (!k) return "<empty>";
  if (k.length <= 8) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
