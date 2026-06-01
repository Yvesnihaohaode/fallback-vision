// ============================================================================
// Anthropic Messages Protocol — Conversion
// ============================================================================

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string | Array<{ type: string; text: string }>;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64" | "url"; media_type?: string; data?: string; url?: string } }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: string | AnthropicContentBlock[] }
  | { type: "web_search_tool_result"; tool_use_id: string; content: string };

export interface AnthropicTool {
  type?: string;     // "web_search_20250305" for server-side search, undefined for custom function tools
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
  max_uses?: number;
}

export interface AnthropicToolChoice {
  type: "auto" | "any" | "tool";
  name?: string;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "tool_use" | null;
  usage: { input_tokens: number; output_tokens: number };
}

export function hasAnthropicImages(body: unknown): boolean {
  const b = body as AnthropicRequest;
  if (!Array.isArray(b.messages)) return false;
  for (const msg of b.messages) {
    if (typeof msg.content === "string") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === "image") return true;
    }
  }
  return false;
}

// ============================================================================
// Web Search & Web Fetch interception utilities
// ============================================================================

/** Check if an Anthropic request contains web_search_20250305 tools. */
export function hasWebSearchTools(tools?: AnthropicTool[]): boolean {
  if (!tools?.length) return false;
  return tools.some((t) => t.type === "web_search_20250305");
}

/** Check if an Anthropic request contains a web_fetch custom tool. */
export function hasWebFetchTools(tools?: AnthropicTool[]): boolean {
  if (!tools?.length) return false;
  return tools.some((t) => !t.type && t.name === "web_fetch");
}

/** Extract the first URL from the last user message. */
export function extractUrlFromMessages(messages: AnthropicMessage[]): string | null {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return null;
  const text = typeof lastUserMsg.content === "string"
    ? lastUserMsg.content
    : lastUserMsg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");
  const match = text.match(/https?:\/\/[^\s)]+/);
  return match ? match[0] : null;
}

/** Extract the raw text from the last user message — no cleaning applied. */
export function extractRawQuery(body: unknown): string {
  const b = body as AnthropicRequest;
  if (!Array.isArray(b.messages)) return "";
  const lastUserMsg = [...b.messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return "";
  return typeof lastUserMsg.content === "string"
    ? lastUserMsg.content
    : Array.isArray(lastUserMsg.content)
      ? lastUserMsg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n")
      : "";
}

/** Extract a search query from the last user message in the request. */
export function extractSearchQuery(body: unknown): string {
  const raw = extractRawQuery(body);
  return cleanSearchQuery(raw);
}

/**
 * Use the main model to extract clean search keywords from a raw user message.
 *
 * Uses system-prompt role definition rather than few-shot completion — this
 * minimizes reasoning overhead on reasoning models (MiMo, DeepSeek-R1, etc.).
 * With reasoning models, expect 2-5s latency. Used as a fallback when regex
 * stripping fails on unusual phrasings.
 *
 * max_tokens=200 to accommodate reasoning overhead (~50-150 tokens of internal
 * reasoning before the model outputs the extracted keywords).
 */
export async function extractQueryWithAI(rawQuery: string): Promise<string | null> {
  const { loadSettings } = await import("../config/settings.js");
  const { callUpstreamChat } = await import("../proxy/upstream.js");

  const settings = loadSettings();
  if (!settings.mainModel.apiKey || !settings.mainModel.baseUrl) return null;

  const baseUrl = settings.mainModel.baseUrl.toLowerCase();
  if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) return null;

  try {
    const wireFormat = settings.mainModel.wireFormat ?? "openai";
    const response = await callUpstreamChat(
      settings.mainModel.baseUrl,
      settings.mainModel.apiKey,
      {
        model: settings.mainModel.modelName,
        messages: [
          { role: "system", content: "你是搜索关键词提取器，把用户的自然语言搜索需求提炼成搜索引擎关键词。仅输出关键词，不解释。" },
          { role: "user", content: rawQuery },
        ],
        max_tokens: 200,
        temperature: 0,
      },
      wireFormat,
    );

    let text: string | undefined;
    if (wireFormat === "anthropic") {
      const content = (response as Record<string, unknown>).content as Array<{ type: string; text: string }> | undefined;
      text = content?.find((c) => c.type === "text")?.text?.trim();
    } else {
      const choices = (response as Record<string, unknown>).choices as Array<{ message: { content: string } }> | undefined;
      text = choices?.[0]?.message?.content?.trim();
    }

    if (!text || text.length < 2) return null;

    return text.replace(/^["']|["']$/g, "").trim();
  } catch {
    return null;
  }
}

/**
 * Strip conversational instruction prefixes from a search query.
 * Users say "帮我搜索一下今天的天气" but search engines need "今天的天气".
 * Applies patterns iteratively until the result stabilizes — handles
 * stacked prefixes like "能不能帮我搜一下" → "最近的电影".
 */
function cleanSearchQuery(raw: string): string {
  const cnPattern = /^(?:能不能|能否|可不可以|可以|拜托|求你|你?帮我|请帮我|麻烦你|麻烦|请|帮忙|你帮|我想|我要|\s)*(?:详细|仔细|认真|快速|简单|大概|大致|帮忙|赶快|赶紧)?(?:搜索一下|搜索|查询一下|查询|搜寻|查找一下|查找|搜一下|搜一搜|搜搜|搜|查一下|查一查|查查|查|找一下|找一找|找找|找|看看|看|了解(?:一下)?|知道|告诉(?:我|一下)?)(?:一下|一查|一搜|一找|一看|下)?[：:，,。.\s]*/i;

  const enPattern = /^(?:search for|search|find|look up|look for|tell me about|tell me|what is|what are|who is|how to|can you|could you|please|i want to|i need to|i would like to|what|who|how|when|where|why|which|information about|info on|the|a|an)\s+/i;

  let result = raw.trim();
  // Loop until stable (max 5 iterations — safety against infinite loops)
  for (let i = 0; i < 5; i++) {
    const prev = result;
    result = result.replace(cnPattern, "").trim();
    result = result.replace(enPattern, "").trim();
    if (result === prev) break;
  }
  return result;
}

/**
 * Build an Anthropic response containing web_search_tool_result blocks.
 * This mimics what Anthropic's own API returns when it executes a web search
 * server-side. Claude Code receives these results and sends a follow-up
 * request where the model generates the actual answer.
 */
export function buildWebSearchResponse(
  searchResults: string,
  model: string,
  toolUseId?: string,
): AnthropicResponse {
  return {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "web_search_tool_result",
        tool_use_id: toolUseId ?? `toolu_${Date.now().toString(36)}`,
        content: searchResults,
      },
    ],
    model,
    stop_reason: "tool_use",
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

// ============================================================================
// Anthropic → OpenAI Chat Completions
// ============================================================================

export function anthropicToChat(req: AnthropicRequest): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  // System prompt
  if (req.system) {
    const text = typeof req.system === "string"
      ? req.system
      : Array.isArray(req.system) ? req.system.map((b) => b.text).join("\n") : "";
    messages.push({ role: "system", content: text });
  }

  for (const msg of req.messages) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;

    const textParts: string[] = [];
    const imageParts: unknown[] = [];
    const toolUseBlocks: AnthropicContentBlock[] = [];
    const toolResultBlocks: AnthropicContentBlock[] = [];

    for (const block of msg.content) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "image") {
        const src = block.source;
        if (src.type === "base64" && src.data) {
          imageParts.push({ type: "image_url", image_url: { url: `data:${src.media_type};base64,${src.data}` } });
        } else if (src.type === "url" && src.url) {
          imageParts.push({ type: "image_url", image_url: { url: src.url } });
        }
      }
      else if (block.type === "tool_use") toolUseBlocks.push(block);
      else if (block.type === "tool_result") toolResultBlocks.push(block);
    }

    if (msg.role === "assistant" && toolUseBlocks.length > 0) {
      messages.push({
        role: "assistant",
        content: textParts.join("\n") || null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.type === "tool_use" ? b.id : "",
          type: "function",
          function: {
            name: b.type === "tool_use" ? b.name : "",
            arguments: b.type === "tool_use" ? (typeof b.input === "string" ? b.input : JSON.stringify(b.input)) : "{}",
          },
        })),
      });
      continue;
    }

    if (msg.role === "user" && toolResultBlocks.length > 0) {
      for (const tr of toolResultBlocks) {
        if (tr.type !== "tool_result") continue;
        const content = typeof tr.content === "string" ? tr.content
          : Array.isArray(tr.content) ? tr.content.filter((b) => b.type === "text").map((b) => b.type === "text" ? b.text : "").join("\n") : "";
        messages.push({ role: "tool", tool_call_id: tr.tool_use_id, content });
      }
      continue;
    }

    const parts: unknown[] = [...imageParts];
    if (textParts.length > 0) parts.push({ type: "text", text: textParts.join("\n") });

    if (parts.length === 1 && parts[0] && typeof parts[0] === "object" && "text" in (parts[0] as Record<string, unknown>)) {
      messages.push({ role: msg.role, content: (parts[0] as { text: string }).text });
    } else if (parts.length > 0) {
      messages.push({ role: msg.role, content: parts });
    } else {
      messages.push({ role: msg.role, content: "" });
    }
  }

  const r: Record<string, unknown> = { model: req.model, messages };
  if (req.tools && req.tools.length > 0) {
    r.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description ?? "", parameters: t.input_schema },
    }));
  }
  if (req.tool_choice) {
    if (req.tool_choice.type === "auto") r.tool_choice = "auto";
    else if (req.tool_choice.type === "any") r.tool_choice = "required";
    else if (req.tool_choice.type === "tool" && req.tool_choice.name) r.tool_choice = { type: "function", function: { name: req.tool_choice.name } };
  }
  if (req.temperature !== undefined) r.temperature = req.temperature;
  if (req.top_p !== undefined) r.top_p = req.top_p;
  if (req.max_tokens !== undefined) r.max_tokens = req.max_tokens;
  return r;
}

// ============================================================================
// OpenAI Chat Completions → Anthropic Messages
// ============================================================================

export function chatToAnthropic(
  chatResponse: Record<string, unknown>,
  requestModel: string,
): AnthropicResponse {
  const choices = chatResponse.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const msg = choice?.message as Record<string, unknown> | undefined;
  const content: AnthropicContentBlock[] = [];

  if (msg?.content && typeof msg.content === "string") {
    content.push({ type: "text", text: msg.content });
  }

  const toolCalls = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      const fn = tc.function as Record<string, unknown> | undefined;
      let input: unknown = {};
      try { input = JSON.parse((fn?.arguments as string) ?? "{}"); } catch { input = {}; }
      content.push({
        type: "tool_use",
        id: (tc.id as string) ?? `toolu_${Date.now()}`,
        name: (fn?.name as string) ?? "unknown",
        input,
      });
    }
  }

  const finishReason = choice?.finish_reason as string | undefined;
  let stopReason: AnthropicResponse["stop_reason"] = "end_turn";
  if (finishReason === "length") stopReason = "max_tokens";
  else if (finishReason === "tool_calls") stopReason = "tool_use";

  const usage = chatResponse.usage as Record<string, number> | undefined;

  // Use the actual model from the upstream response if available,
  // otherwise fall back to the request model.
  // This lets Claude Code display the real model name (e.g., deepseek-v4-pro)
  // instead of the proxy's canonical name (e.g., claude-sonnet-4-6).
  const upstreamModel = (chatResponse.model as string) || requestModel;

  return {
    id: (chatResponse.id as string) ?? `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: upstreamModel,
    stop_reason: stopReason,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  };
}

// ============================================================================
// OpenAI SSE → Anthropic SSE Streaming Converter
// ============================================================================

/** Parse a single SSE "data:" line */
function parseOpenAIChunk(line: string): { done: boolean; chunk: Record<string, unknown> | null } {
  if (!line.startsWith("data: ")) return { done: false, chunk: null };
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return { done: true, chunk: null };
  try { return { done: false, chunk: JSON.parse(payload) as Record<string, unknown> }; }
  catch { return { done: false, chunk: null }; }
}

/** Emit one Anthropic SSE event block */
function emitSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Convert an OpenAI SSE stream to Anthropic SSE stream.
 *
 * OpenAI sends: data: {"choices":[{"delta":{"content":"Hello"}}]}
 * Anthropic expects: event: content_block_delta\ndata: {"type":"content_block_delta",...}
 */
export async function* openaiSSEToAnthropicSSE(
  upstreamLines: AsyncGenerator<string, void, unknown>,
  requestModel: string,
  messageId?: string,
  hintModel?: string,
): AsyncGenerator<string, void, unknown> {
  const msgId = messageId ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  // Track the actual upstream model name
  let actualModel = hintModel || requestModel;

  // message_start
  yield emitSSE("message_start", {
    type: "message_start",
    message: {
      id: msgId, type: "message", role: "assistant", content: [],
      model: actualModel, stop_reason: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  yield emitSSE("ping", { type: "ping" });

  // State
  let blockIdx = 0;
  let textOpen = false;
  let toolBlockIdx = -1;
  let finishReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  function* closeText() {
    if (textOpen) {
      yield emitSSE("content_block_stop", { type: "content_block_stop", index: blockIdx });
      blockIdx++;
      textOpen = false;
    }
  }

  function* openText() {
    if (!textOpen) {
      yield emitSSE("content_block_start", {
        type: "content_block_start", index: blockIdx,
        content_block: { type: "text", text: "" },
      });
      textOpen = true;
    }
  }

  // Process upstream stream
  let lineBuffer = "";
  let done = false;

  for await (const rawChunk of upstreamLines) {
    if (done) break;
    lineBuffer += rawChunk;
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (done) break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      const { done: isDone, chunk } = parseOpenAIChunk(trimmed);
      if (isDone) { done = true; finishReason = finishReason ?? "stop"; break; }
      if (!chunk) continue;

      // Capture the actual upstream model name
      if (chunk.model && typeof chunk.model === "string") {
        actualModel = chunk.model;
      }

      const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
      if (!choices?.length) continue;

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;
      const reason = (choice.finish_reason ?? chunk.finish_reason) as string | null;
      if (reason) finishReason = reason;

      const usage = chunk.usage as Record<string, number> | undefined;
      if (usage?.prompt_tokens) inputTokens = usage.prompt_tokens;
      if (usage?.completion_tokens) outputTokens = usage.completion_tokens;

      if (!delta) continue;

      // Text content
      if (typeof delta.content === "string" && delta.content) {
        yield* openText();
        yield emitSSE("content_block_delta", {
          type: "content_block_delta", index: blockIdx,
          delta: { type: "text_delta", text: delta.content },
        });
      }

      // Tool calls
      const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const fn = tc.function as Record<string, unknown> | undefined;

          if (fn?.name && typeof fn.name === "string") {
            yield* closeText();
            // Close previous tool block if one was open
            if (toolBlockIdx >= 0) {
              yield emitSSE("content_block_stop", { type: "content_block_stop", index: toolBlockIdx });
            }
            toolBlockIdx = blockIdx;

            yield emitSSE("content_block_start", {
              type: "content_block_start", index: blockIdx,
              content_block: {
                type: "tool_use",
                id: (tc.id as string) ?? `toolu_${Date.now()}_${tc.index}`,
                name: fn.name, input: {},
              },
            });
          }

          if (fn?.arguments && typeof fn.arguments === "string" && fn.arguments && toolBlockIdx >= 0) {
            yield emitSSE("content_block_delta", {
              type: "content_block_delta", index: toolBlockIdx,
              delta: { type: "input_json_delta", partial_json: fn.arguments },
            });
          }
        }
      }
    }
  }

  // Close any open blocks
  yield* closeText();
  if (toolBlockIdx >= 0 && toolBlockIdx === blockIdx) {
    yield emitSSE("content_block_stop", { type: "content_block_stop", index: blockIdx });
    blockIdx++;
  }

  // Map stop reason
  let stopReason = "end_turn";
  if (finishReason === "length") stopReason = "max_tokens";
  else if (finishReason === "tool_calls") stopReason = "tool_use";

  yield emitSSE("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: outputTokens },
  });
  yield emitSSE("message_stop", { type: "message_stop" });
}
