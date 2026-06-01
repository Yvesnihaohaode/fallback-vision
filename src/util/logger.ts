import { RingBuffer } from "./ring-buffer.js";

type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  extra?: string;
}

let verbose = false;
const logBuffer = new RingBuffer<LogEntry>(200);

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
  if (extra) {
    console.error(prefix, msg, JSON.stringify(extra));
  } else {
    console.error(prefix, msg);
  }
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
