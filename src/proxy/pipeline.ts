import { log } from "../util/logger.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { detectImages } from "../routing/capability.js";
import { callUpstream } from "./upstream.js";
import {
  hasAnthropicImages,
  chatToAnthropic,
  type AnthropicRequest,
  type AnthropicContentBlock,
  type AnthropicMessage,
} from "../translate/anthropic.js";
import {
  hasLocalTools,
  extractLocalToolCalls,
  executeLocalTools,
} from "../tools/interceptor.js";
import { loadSettings, isMiMoModel } from "../config/settings.js";

export type Protocol = "openai" | "anthropic";

interface PipelineResult {
  response: unknown;
  latencyMs: number;
  visionLatencyMs: number;
  mainLatencyMs: number;
  usedVision: boolean;
  visionModelId: string;
  mainModelId: string;
  protocol: Protocol;
}

const MAX_TOOL_ROUNDS = 3;
const TOOL_TIMEOUT_MS = 30_000;

// ============================================================================
// Main Pipeline
// ============================================================================

export async function executePipeline(
  registry: ProviderRegistry,
  body: unknown,
  protocol: Protocol,
  version: string
): Promise<PipelineResult> {
  const mainProvider = registry.get("main");
  const visionProvider = registry.get("vision");

  if (!mainProvider?.isAvailable()) {
    throw new Error("main model not configured — set API key in Settings");
  }

  const mainModelId = mainProvider.config.defaultModel;
  const mainUrl = mainProvider.config.baseUrl;
  const mainKey = mainProvider.config.apiKey;

  const hasImages = protocol === "anthropic"
    ? hasAnthropicImages(body)
    : detectImages({ format: "chat-completions", model: "", stream: false, hasImages: false, hasTools: false, messages: [], raw: body });

  // No images → direct to main
  if (!hasImages || !visionProvider?.isAvailable()) {
    const start = Date.now();
    const path = protocol === "anthropic" ? "/messages" : "/chat/completions";
    const res = await callUpstream(
      { baseUrl: mainUrl, apiKey: mainKey, model: mainProvider.getModel(mainModelId)!, userAgent: `fallback-vision/${version}` },
      body, path
    );
    const latencyMs = Date.now() - start;
    const rawResponse = JSON.parse(await res.text());
    const response = protocol === "anthropic" ? chatToAnthropic(rawResponse, mainModelId) : rawResponse;
    return { response, latencyMs, visionLatencyMs: 0, mainLatencyMs: latencyMs, usedVision: false, visionModelId: "", mainModelId, protocol };
  }

  // Two-step pipeline: vision → main
  const visionModelId = visionProvider.config.defaultModel;
  const visionUrl = visionProvider.config.baseUrl;
  const visionKey = visionProvider.config.apiKey;

  log.info(`[pipeline] step 1: image → vision model ${visionModelId}`);
  const step1Start = Date.now();
  const visionPrompt = buildVisionPrompt(body, protocol);
  const visionRes = await callUpstream(
    { baseUrl: visionUrl, apiKey: visionKey, model: visionProvider.getModel(visionModelId)!, userAgent: `fallback-vision/${version}` },
    visionPrompt, "/chat/completions"
  );
  const visionBody = JSON.parse(await visionRes.text()) as { choices?: Array<{ message?: { content?: string } }> };
  const visionDescription = visionBody.choices?.[0]?.message?.content ?? "(vision model returned empty)";
  const visionLatencyMs = Date.now() - step1Start;
  log.info(`[pipeline] step 1 done: ${visionLatencyMs}ms, length: ${visionDescription.length}`);

  log.info(`[pipeline] step 2: question + description → main model ${mainModelId}`);
  const step2Start = Date.now();
  const mainPrompt = buildMainPrompt(body, visionDescription, protocol);
  const mainPath = protocol === "anthropic" ? "/messages" : "/chat/completions";
  const mainRes = await callUpstream(
    { baseUrl: mainUrl, apiKey: mainKey, model: mainProvider.getModel(mainModelId)!, userAgent: `fallback-vision/${version}` },
    mainPrompt, mainPath
  );
  const rawMainResponse = JSON.parse(await mainRes.text());
  const mainLatencyMs = Date.now() - step2Start;
  const response = protocol === "anthropic" ? chatToAnthropic(rawMainResponse, mainModelId) : rawMainResponse;
  log.info(`[pipeline] step 2 done: ${mainLatencyMs}ms`);

  return {
    response, latencyMs: visionLatencyMs + mainLatencyMs,
    visionLatencyMs, mainLatencyMs, usedVision: true,
    visionModelId, mainModelId, protocol,
  };
}

// ============================================================================
// Tool Interception — only when main model is MiMo + user enabled the toggle
// ============================================================================

export async function executeWithToolInterception(
  registry: ProviderRegistry,
  body: unknown,
  protocol: Protocol,
  version: string
): Promise<PipelineResult> {
  const settings = loadSettings();
  const mainProvider = registry.get("main");

  if (!mainProvider?.isAvailable()) {
    throw new Error("main model not configured");
  }

  // Check if local search is enabled AND main model is MiMo
  const isMiMo = isMiMoModel(settings.mainModel.modelName);
  const localSearchEnabled = settings.localSearchEnabled ?? false;

  if (!localSearchEnabled || !isMiMo || protocol !== "anthropic") {
    // Not MiMo or not enabled → normal pipeline
    return executePipeline(registry, body, protocol, version);
  }

  const req = body as AnthropicRequest;
  if (!hasLocalTools(req.tools)) {
    return executePipeline(registry, body, protocol, version);
  }

  const mainUrl = mainProvider.config.baseUrl;
  const mainKey = mainProvider.config.apiKey;
  const mainModelId = mainProvider.config.defaultModel;

  log.info("[tool-intercept] MiMo + local search enabled, intercepting tools");

  const filteredTools = (req.tools ?? []).filter((t) => {
    return !["web_search", "web_fetch", "WebSearch"].includes(t.name);
  });

  let currentMessages: AnthropicMessage[] = [...req.messages];
  let currentTools = filteredTools.length > 0 ? filteredTools : undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    log.info(`[tool-intercept] round ${round + 1}`);

    try {
      const sendBody: AnthropicRequest = {
        model: req.model,
        max_tokens: req.max_tokens,
        system: req.system,
        messages: currentMessages,
        tools: currentTools,
        stream: false,
      };

      const res = await callUpstream(
        { baseUrl: mainUrl, apiKey: mainKey, model: mainProvider.getModel(mainModelId)!, userAgent: `fallback-vision/${version}`, timeoutMs: TOOL_TIMEOUT_MS },
        sendBody, "/messages"
      );
      const response = JSON.parse(await res.text());

      const localCalls = extractLocalToolCalls(response);
      if (localCalls.length === 0) {
        return {
          response: chatToAnthropic(response, mainModelId),
          latencyMs: 0, visionLatencyMs: 0, mainLatencyMs: 0,
          usedVision: false, visionModelId: "", mainModelId, protocol,
        };
      }

      log.info(`[tool-intercept] executing ${localCalls.length} local tool(s)`);
      const toolResults = await executeLocalTools(localCalls);

      currentMessages = [
        ...currentMessages,
        response as AnthropicMessage,
        {
          role: "user",
          content: toolResults.map((tr) => ({
            type: "tool_result" as const,
            tool_use_id: tr.tool_use_id,
            content: tr.content,
          })),
        },
      ];
    } catch (err) {
      log.error(`[tool-intercept] round ${round + 1} failed: ${(err as Error).message}`);
      // Timeout or error → break loop, return what we have
      break;
    }
  }

  // Final attempt without tool loop
  const lastRes = await callUpstream(
    { baseUrl: mainUrl, apiKey: mainKey, model: mainProvider.getModel(mainModelId)!, userAgent: `fallback-vision/${version}`, timeoutMs: TOOL_TIMEOUT_MS },
    { model: req.model, max_tokens: req.max_tokens, system: req.system, messages: currentMessages, tools: currentTools, stream: false },
    "/messages"
  );
  const lastResponse = JSON.parse(await lastRes.text());
  return {
    response: chatToAnthropic(lastResponse, mainModelId),
    latencyMs: 0, visionLatencyMs: 0, mainLatencyMs: 0,
    usedVision: false, visionModelId: "", mainModelId, protocol,
  };
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildVisionPrompt(body: unknown, protocol: Protocol): Record<string, unknown> {
  const imageContents: unknown[] = [];
  let userText = "";

  if (protocol === "anthropic") {
    const b = body as AnthropicRequest;
    if (Array.isArray(b.messages)) {
      for (const msg of b.messages) {
        if (msg.role !== "user") continue;
        if (typeof msg.content === "string") { userText = msg.content; continue; }
        if (!Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
          if (block.type === "image") {
            const src = block.source;
            if (src.type === "base64" && src.data) imageContents.push({ type: "image_url", image_url: { url: `data:${src.media_type};base64,${src.data}` } });
            else if (src.type === "url" && src.url) imageContents.push({ type: "image_url", image_url: { url: src.url } });
          } else if (block.type === "text") userText = block.text || userText;
        }
      }
    }
  } else {
    const b = body as { messages?: unknown[] };
    if (Array.isArray(b.messages)) {
      for (const msg of b.messages) {
        const m = msg as { role?: string; content?: unknown };
        if (m.role !== "user") continue;
        if (typeof m.content === "string") { userText = m.content; continue; }
        if (Array.isArray(m.content)) {
          for (const part of m.content) {
            const p = part as { type?: string };
            if (p.type === "image_url" || p.type === "input_image") imageContents.push(part);
            else if (p.type === "text") userText = (p as { text?: string }).text ?? userText;
          }
        }
      }
    }
  }

  return {
    model: undefined, stream: false,
    messages: [
      { role: "system", content: "You are a visual analysis assistant. Analyze the image in detail: objects, people, text, layout, key details. Output in the same language as the user's question." },
      { role: "user", content: [...imageContents, { type: "text", text: userText || "请详细描述这张图片的内容。" }] },
    ],
  };
}

function buildMainPrompt(body: unknown, visionDescription: string, protocol: Protocol): unknown {
  if (protocol === "anthropic") {
    const req = body as AnthropicRequest;
    const systemContent = `[Image Analysis by Vision Model]\n\n${visionDescription}\n\nBased on this image analysis, please answer the user's question. Do NOT mention that you received a description — treat the image content as if you saw it yourself.`;

    const messages: AnthropicMessage[] = [];
    for (const msg of req.messages) {
      if (typeof msg.content === "string") { messages.push({ role: msg.role, content: msg.content }); continue; }
      if (!Array.isArray(msg.content)) continue;
      const cleaned: AnthropicContentBlock[] = [];
      for (const block of msg.content) {
        if (block.type === "text" || block.type === "tool_use" || block.type === "tool_result") cleaned.push(block);
      }
      if (cleaned.length > 0) messages.push({ role: msg.role, content: cleaned });
    }

    return { model: req.model, max_tokens: req.max_tokens, system: systemContent, messages, tools: req.tools, tool_choice: req.tool_choice, stream: false };
  }

  const b = body as { messages?: unknown[]; stream?: boolean; tools?: unknown[]; tool_choice?: unknown };
  const messages: unknown[] = [
    { role: "system", content: `[Image Analysis by Vision Model]\n\n${visionDescription}\n\nBased on this image analysis, please answer the user's question. Do NOT mention that you received a description — treat the image content as if you saw it yourself.` },
  ];

  if (Array.isArray(b.messages)) {
    for (const msg of b.messages) {
      const m = msg as { role?: string };
      if (m.role === "system") continue;
      if (m.role === "user") { const cleaned = stripImages(msg); if (cleaned) messages.push(cleaned); }
      else messages.push(msg);
    }
  }

  return { model: undefined, stream: b.stream ?? false, messages, tools: b.tools, tool_choice: b.tool_choice };
}

function stripImages(msg: unknown): unknown {
  const m = msg as { role?: string; content?: unknown };
  if (typeof m.content === "string") return msg;
  if (!Array.isArray(m.content)) return msg;
  const textParts = m.content.filter((p: { type?: string }) => p.type === "text" || p.type === "input_text");
  if (textParts.length === 0) return null;
  return { ...m, content: textParts };
}
