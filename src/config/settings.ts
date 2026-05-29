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
}

const DEFAULT_SETTINGS: AppSettings = {
  clientType: "codex",
  mainModel: {
    providerName: "",
    apiKey: "",
    baseUrl: "",
    modelName: "",
  },
  visionModel: {
    providerName: "",
    apiKey: "",
    baseUrl: "",
    modelName: "",
  },
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

// ============================================================================
// Model capability database — organized by provider
// ============================================================================
export interface ProviderInfo {
  name: string;
  baseUrl: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  vision: boolean;
  reasoning: boolean;
  description: string;
  tags: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", vision: true, reasoning: true, description: "多模态旗舰，支持图片+文本+代码", tags: ["多模态", "推理"] },
      { id: "gpt-4o-mini", vision: true, reasoning: false, description: "轻量多模态，性价比高", tags: ["多模态", "便宜"] },
      { id: "gpt-4.1", vision: true, reasoning: false, description: "2025新版，指令遵循强", tags: ["多模态", "指令"] },
      { id: "gpt-4.1-mini", vision: true, reasoning: false, description: "轻量版4.1", tags: ["多模态", "便宜"] },
      { id: "o1", vision: true, reasoning: true, description: "推理模型，擅长数学/编程", tags: ["推理", "数学"] },
      { id: "o3", vision: true, reasoning: true, description: "最强推理模型", tags: ["推理", "最强"] },
      { id: "o3-mini", vision: true, reasoning: true, description: "轻量推理模型", tags: ["推理", "便宜"] },
      { id: "o4-mini", vision: true, reasoning: true, description: "最新推理模型", tags: ["推理", "新"] },
    ],
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-sonnet-4-20250514", vision: true, reasoning: true, description: "最新旗舰，多模态+强推理", tags: ["多模态", "推理"] },
      { id: "claude-3-5-sonnet-20241022", vision: true, reasoning: true, description: "上一代旗舰，依然很强", tags: ["多模态", "推理"] },
      { id: "claude-3-5-haiku-20241022", vision: true, reasoning: false, description: "轻量快速，性价比高", tags: ["多模态", "便宜"] },
      { id: "claude-3-opus-20240229", vision: true, reasoning: true, description: "最强推理，但较慢", tags: ["推理", "最强"] },
    ],
  },
  {
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-2.5-pro", vision: true, reasoning: true, description: "最强多模态，支持超长文本", tags: ["多模态", "推理"] },
      { id: "gemini-2.5-flash", vision: true, reasoning: true, description: "快速多模态，性价比极高", tags: ["多模态", "便宜"] },
      { id: "gemini-2.0-flash", vision: true, reasoning: false, description: "轻量多模态", tags: ["多模态", "快"] },
    ],
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", vision: false, reasoning: true, description: "通用对话，强推理", tags: ["推理", "便宜"] },
      { id: "deepseek-coder", vision: false, reasoning: true, description: "代码专用，编程强", tags: ["代码", "推理"] },
      { id: "deepseek-reasoner", vision: false, reasoning: true, description: "深度推理，数学/逻辑强", tags: ["推理", "数学"] },
    ],
  },
  {
    name: "MiMo",
    baseUrl: "",
    models: [
      { id: "mimo-v2.5-pro", vision: false, reasoning: true, description: "推理强，不支持图片", tags: ["推理"] },
      { id: "mimo-v2-pro", vision: false, reasoning: true, description: "推理强，不支持图片", tags: ["推理"] },
      { id: "mimo-v2.5", vision: true, reasoning: true, description: "支持视觉+推理", tags: ["多模态", "推理"] },
      { id: "mimo-v2-omni", vision: true, reasoning: true, description: "支持视觉+音频+推理", tags: ["多模态", "音频"] },
      { id: "mimo-v2-flash", vision: false, reasoning: false, description: "轻量快速", tags: ["快"] },
    ],
  },
  {
    name: "Qwen (通义千问)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-vl-max", vision: true, reasoning: false, description: "多模态，视觉强", tags: ["多模态"] },
      { id: "qwen-vl-plus", vision: true, reasoning: false, description: "轻量多模态", tags: ["多模态", "便宜"] },
      { id: "qwen-max", vision: false, reasoning: true, description: "最强推理", tags: ["推理", "最强"] },
      { id: "qwen-plus", vision: false, reasoning: true, description: "通用推理", tags: ["推理"] },
      { id: "qwen-turbo", vision: false, reasoning: false, description: "轻量快速", tags: ["快", "便宜"] },
    ],
  },
  {
    name: "其他",
    baseUrl: "",
    models: [],
  },
];

// Legacy known model database (for detectModelCapabilities)
const KNOWN_MODELS: Record<string, { vision: boolean; reasoning: boolean; description: string }> = {};
for (const p of PROVIDERS) {
  for (const m of p.models) {
    KNOWN_MODELS[m.id] = { vision: m.vision, reasoning: m.reasoning, description: m.description };
  }
}

export function detectModelCapabilities(modelName: string): {
  vision: boolean; reasoning: boolean; description: string; known: boolean;
} {
  const known = KNOWN_MODELS[modelName];
  if (known) return { ...known, known: true };
  const lower = modelName.toLowerCase();
  const vision = lower.includes("vision") || lower.includes("vl") || lower.includes("omni") || lower.includes("gpt-4o") || lower.includes("claude") || lower.includes("gemini");
  const reasoning = lower.includes("reason") || lower.includes("think") || lower.includes("o1") || lower.includes("o3") || lower.includes("o4") || lower.includes("deepseek-reasoner");
  return { vision, reasoning, description: "未识别的模型 — 根据名称推测能力", known: false };
}

// Check if a model ID belongs to MiMo
export function isMiMoModel(modelId: string): boolean {
  const mimoProvider = PROVIDERS.find(p => p.name === "MiMo");
  if (!mimoProvider) return false;
  return mimoProvider.models.some(m => m.id === modelId);
}
