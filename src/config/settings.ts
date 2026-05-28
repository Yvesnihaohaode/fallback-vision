import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type ClientType = "codex" | "claude";

export interface ModelSlot {
  providerName: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface AppSettings {
  clientType: ClientType;
  mainModel: ModelSlot;
  visionModel: ModelSlot;
  localSearchEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  clientType: "codex",
  mainModel: {
    providerName: "DeepSeek",
    apiKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    modelName: "deepseek-v4-pro",
  },
  visionModel: {
    providerName: "MiMo",
    apiKey: "",
    baseUrl: "https://api.xiaomimimo.com/v1",
    modelName: "mimo-v2.5",
  },
  localSearchEnabled: false,
};

function getSettingsPath(): string {
  return join(homedir(), ".fallback-vision", "settings.json");
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();
  if (!existsSync(filePath)) return structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      clientType: parsed.clientType ?? DEFAULT_SETTINGS.clientType,
      mainModel: { ...DEFAULT_SETTINGS.mainModel, ...parsed.mainModel },
      visionModel: { ...DEFAULT_SETTINGS.visionModel, ...parsed.visionModel },
      localSearchEnabled: parsed.localSearchEnabled ?? DEFAULT_SETTINGS.localSearchEnabled,
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

// Known model capability database
interface KnownModel { vision: boolean; reasoning: boolean; description: string; }
const KNOWN_MODELS: Record<string, KnownModel> = {
  "mimo-v2.5-pro":{vision:false,reasoning:true,description:"MiMo V2.5 Pro — 推理强，不支持图片"},
  "mimo-v2-pro":{vision:false,reasoning:true,description:"MiMo V2 Pro — 推理强，不支持图片"},
  "mimo-v2.5":{vision:true,reasoning:true,description:"MiMo V2.5 — 支持视觉 + 推理"},
  "mimo-v2-omni":{vision:true,reasoning:true,description:"MiMo V2 Omni — 支持视觉 + 音频 + 推理"},
  "mimo-v2-flash":{vision:false,reasoning:false,description:"MiMo V2 Flash — 轻量快速"},
  "deepseek-v4-pro":{vision:false,reasoning:true,description:"DeepSeek V4 Pro — 推理强，不支持图片"},
  "deepseek-v4-flash":{vision:false,reasoning:true,description:"DeepSeek V4 Flash — 快速推理"},
  "gpt-4o":{vision:true,reasoning:true,description:"GPT-4o — 多模态，支持图片 + 推理"},
  "gpt-4o-mini":{vision:true,reasoning:false,description:"GPT-4o Mini — 多模态，轻量"},
  "o1":{vision:true,reasoning:true,description:"OpenAI o1 — 推理模型，支持图片"},
  "o3":{vision:true,reasoning:true,description:"OpenAI o3 — 推理模型，支持图片"},
  "o4-mini":{vision:true,reasoning:true,description:"OpenAI o4-mini — 推理模型，支持图片"},
  "claude-sonnet-4-20250514":{vision:true,reasoning:true,description:"Claude Sonnet 4 — 多模态，强推理"},
  "claude-3-5-sonnet-20241022":{vision:true,reasoning:true,description:"Claude 3.5 Sonnet — 多模态，强推理"},
  "claude-3-5-haiku-20241022":{vision:true,reasoning:false,description:"Claude 3.5 Haiku — 多模态，快速"},
  "claude-3-opus-20240229":{vision:true,reasoning:true,description:"Claude 3 Opus — 多模态，最强推理"},
  "gemini-2.5-pro":{vision:true,reasoning:true,description:"Gemini 2.5 Pro — 多模态，强推理"},
  "gemini-2.5-flash":{vision:true,reasoning:true,description:"Gemini 2.5 Flash — 多模态，快速"},
  "qwen-vl-max":{vision:true,reasoning:false,description:"通义千问 VL Max — 多模态"},
  "qwen-max":{vision:false,reasoning:true,description:"通义千问 Max — 推理"},
};

export function detectModelCapabilities(modelName: string): {
  vision: boolean; reasoning: boolean; description: string; known: boolean;
} {
  const known = KNOWN_MODELS[modelName];
  if (known) return { ...known, known: true };
  const lower = modelName.toLowerCase();
  const vision = lower.includes("vision") || lower.includes("vl") || lower.includes("omni");
  const reasoning = lower.includes("reason") || lower.includes("think") || lower.includes("o1") || lower.includes("o3");
  return { vision, reasoning, description: "未识别的模型 — 根据名称推测能力", known: false };
}
