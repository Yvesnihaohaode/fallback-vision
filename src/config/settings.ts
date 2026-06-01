import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type ClientType = "codex" | "claude";

export interface ModelSlot {
  providerName: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  wireFormat?: "openai" | "anthropic";
}

export interface AppSettings {
  clientType: ClientType;
  mainModel: ModelSlot;
  visionModel: ModelSlot;
  claudeModelAlias: string;
  localSearchEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  clientType: "claude",
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
  claudeModelAlias: "claude-3-5-sonnet-20241022",
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
      claudeModelAlias: parsed.claudeModelAlias ?? DEFAULT_SETTINGS.claudeModelAlias,
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
      { id: "gpt-5.5", vision: true, reasoning: true, description: "2026年4月最新旗舰", tags: ["多模态", "推理", "最新"] },
      { id: "gpt-5.5-mini", vision: true, reasoning: true, description: "轻量版5.5", tags: ["多模态", "推理"] },
      { id: "gpt-5.4", vision: true, reasoning: true, description: "1M上下文+原生Computer Use", tags: ["多模态", "推理"] },
      { id: "gpt-5.4-mini", vision: true, reasoning: true, description: "轻量旗舰，推理能力强", tags: ["多模态", "推理"] },
      { id: "gpt-5.4-nano", vision: true, reasoning: false, description: "最轻量，极速响应", tags: ["多模态", "快"] },
      { id: "gpt-5.2", vision: true, reasoning: true, description: "上一代旗舰，依然很强", tags: ["多模态", "推理"] },
      { id: "gpt-5.2-pro", vision: true, reasoning: true, description: "Pro版本，更多算力", tags: ["推理", "最强"] },
      { id: "gpt-5.1", vision: true, reasoning: true, description: "引入Instant/Thinking双模式", tags: ["多模态", "推理"] },
      { id: "gpt-5.1-mini", vision: true, reasoning: false, description: "轻量版5.1", tags: ["多模态", "便宜"] },
      { id: "gpt-5", vision: true, reasoning: true, description: "GPT-5基础版，融合o系列推理", tags: ["多模态", "推理"] },
      { id: "gpt-4o", vision: true, reasoning: true, description: "经典多模态，稳定可靠", tags: ["多模态", "推理"] },
      { id: "gpt-4o-mini", vision: true, reasoning: false, description: "轻量多模态，性价比高", tags: ["多模态", "便宜"] },
      { id: "gpt-4.1", vision: true, reasoning: false, description: "指令遵循强", tags: ["多模态", "指令"] },
      { id: "gpt-4.1-mini", vision: true, reasoning: false, description: "轻量版4.1", tags: ["多模态", "便宜"] },
      { id: "o3-pro", vision: true, reasoning: true, description: "最强推理，Pro算力", tags: ["推理", "最强"] },
    ],
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-opus-4-8", vision: true, reasoning: true, description: "最强旗舰，顶级推理+编码", tags: ["推理", "最强"] },
      { id: "claude-opus-4-7", vision: true, reasoning: true, description: "上一代旗舰，依然顶尖", tags: ["推理", "最强"] },
      { id: "claude-opus-4-6", vision: true, reasoning: true, description: "稳定旗舰版", tags: ["推理"] },
      { id: "claude-sonnet-4-6", vision: true, reasoning: true, description: "最佳速度+智能平衡", tags: ["多模态", "推理"] },
      { id: "claude-sonnet-4-5", vision: true, reasoning: true, description: "上一代Sonnet，性价比高", tags: ["多模态", "推理"] },
      { id: "claude-haiku-4-5", vision: true, reasoning: false, description: "极速响应，近前沿智能", tags: ["多模态", "快"] },
    ],
  },
  {
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-3.5-flash", vision: true, reasoning: true, description: "最新Gemini 3.5，速度快", tags: ["多模态", "推理", "最新"] },
      { id: "gemini-3.1-pro", vision: true, reasoning: true, description: "Gemini 3 Pro预览版", tags: ["多模态", "推理"] },
      { id: "gemini-3-flash", vision: true, reasoning: true, description: "Gemini 3快速版", tags: ["多模态", "快"] },
      { id: "gemini-2.5-pro", vision: true, reasoning: true, description: "最强多模态，超长文本", tags: ["多模态", "推理"] },
      { id: "gemini-2.5-flash", vision: true, reasoning: true, description: "快速多模态，性价比极高", tags: ["多模态", "便宜"] },
      { id: "gemini-2.5-flash-lite", vision: true, reasoning: false, description: "最轻量多模态", tags: ["多模态", "快"] },
    ],
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-v4-pro", vision: false, reasoning: true, description: "V4旗舰，深度推理，1M上下文", tags: ["推理", "旗舰"] },
      { id: "deepseek-v4-flash", vision: false, reasoning: true, description: "V4快速版，支持思考模式", tags: ["推理", "便宜"] },
      { id: "deepseek-chat", vision: false, reasoning: false, description: "通用对话（v4-flash别名）", tags: ["便宜"] },
      { id: "deepseek-reasoner", vision: false, reasoning: true, description: "深度推理（v4-flash别名）", tags: ["推理"] },
    ],
  },
  {
    name: "MiMo (小米)",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    models: [
      { id: "mimo-v2.5-pro", vision: false, reasoning: true, description: "最新旗舰，310B参数，强推理", tags: ["推理", "旗舰"] },
      { id: "mimo-v2.5", vision: true, reasoning: true, description: "多模态，支持视觉+音频+推理", tags: ["多模态", "推理"] },
      { id: "mimo-v2-flash", vision: false, reasoning: false, description: "高效推理，Agent基础模型", tags: ["快"] },
    ],
  },
  {
    name: "Qwen (通义千问)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen3.7-max", vision: false, reasoning: true, description: "最新旗舰，最强推理", tags: ["推理", "最新", "最强"] },
      { id: "qwen3.6-plus", vision: true, reasoning: true, description: "多模态旗舰，均衡", tags: ["多模态", "推理"] },
      { id: "qwen3.6-flash", vision: true, reasoning: true, description: "快速多模态", tags: ["多模态", "快"] },
      { id: "qwen3.5-plus", vision: true, reasoning: true, description: "上一代多模态旗舰", tags: ["多模态", "推理"] },
      { id: "qwen3.5-flash", vision: true, reasoning: false, description: "轻量多模态", tags: ["多模态", "快"] },
      { id: "qwen-vl-max", vision: true, reasoning: false, description: "视觉专用旗舰", tags: ["多模态"] },
      { id: "qwen-vl-plus", vision: true, reasoning: false, description: "视觉专用，性价比高", tags: ["多模态", "便宜"] },
      { id: "qwen-max", vision: false, reasoning: true, description: "最强推理", tags: ["推理", "最强"] },
      { id: "qwen-plus", vision: false, reasoning: true, description: "通用推理，性价比高", tags: ["推理"] },
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

// Check if the current main model is a MiMo model.
// Detection is by baseUrl (contains xiaomimimo.com) and model name (starts with mimo-),
// NOT by provider name which is user-editable free text.
export function isMiMoModel(modelId?: string): boolean {
  try {
    const settings = loadSettings();
    const url = settings.mainModel.baseUrl.toLowerCase();
    const name = (modelId ?? settings.mainModel.modelName).toLowerCase();
    return url.includes("xiaomimimo.com") || name.startsWith("mimo-");
  } catch {
    return false;
  }
}

// Check if the current main model uses DeepSeek's Anthropic-compatible endpoint.
// DeepSeek's Anthropic endpoint handles web_search_20250305 natively —
// we must NOT intercept it with local search.
export function isDeepSeekModel(): boolean {
  try {
    const settings = loadSettings();
    const url = settings.mainModel.baseUrl.toLowerCase();
    const name = settings.mainModel.modelName.toLowerCase();
    return url.includes("deepseek.com") || name.startsWith("deepseek-");
  } catch {
    return false;
  }
}
