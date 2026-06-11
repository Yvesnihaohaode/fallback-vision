// ============================================================================
// Request Pipeline — single entry point for all model routing
//
// Flow:
// 1. Check if request contains web_search_20250305:
//    - DeepSeek: skip interception → Anthropic endpoint native search
//    - ALL other models (incl. MiMo): intercept locally via hybrid search
// 2. MiMo: inject web_search + web_fetch tools, run tool-call loop
// 3. Resolve main provider (always the user-configured main model)
// 4. Check if request contains images → if yes, route to vision provider
// 5. Convert Anthropic → OpenAI if needed
// 6. Call upstream with correct provider config
// 7. Convert response back to Anthropic if needed
// ============================================================================

import { ProviderRegistry } from "../providers/registry.js";
import {
  anthropicToChat, chatToAnthropic,
  hasAnthropicImages, hasWebSearchTools,
  extractRawQuery, extractSearchQuery, extractQueryWithAI,
  buildWebSearchResponse, openaiSSEToAnthropicSSE,
  type AnthropicRequest, type AnthropicTool,
} from "../translate/anthropic.js";
import { callUpstreamChat, callUpstreamChatStreaming } from "./upstream.js";
import { log } from "../util/logger.js";
import { isMiMoModel, isDeepSeekModel } from "../config/settings.js";
import { hybridSearch } from "../search/index.js";
import { fetchWebContent } from "../tools/interceptor.js";
import type { ProviderInstance } from "../types.js";

export type Protocol = "anthropic" | "openai";

/** Non-streaming pipeline result */
export interface PipelineResult {
  response: Record<string, unknown>;
  protocol: Protocol;
  usedVision: boolean;
  visionModelId: string;
  mainModelId: string;
  latencyMs: number;
}

/** Streaming pipeline result */
export interface PipelineStreamResult {
  protocol: Protocol;
  usedVision: boolean;
  visionModelId: string;
  mainModelId: string;
  latencyMs: number;
  stream: AsyncGenerator<string, void, unknown>;
  usage?: { inputTokens: number; outputTokens: number };
}

// ============================================================================
// MiMo Tool Definitions — injected into tools array for MiMo models
//
// Gives MiMo the ability to decide when to search and fetch web content.
// The proxy executes these tools locally and feeds results back.
// ============================================================================

const MIMO_WEB_SEARCH_TOOL: AnthropicTool = {
  name: "web_search",
  description: "Search the internet in real-time via local proxy. Returns live web results (titles, URLs, snippets). ALWAYS prefer this over any other search method. Use for: current events, weather, news, facts, documentation, or any question requiring up-to-date information.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query keywords" },
      freshness: {
        type: "string",
        enum: ["day", "week", "month", "year"],
        description: "Restrict results to this time window. Use 'day' or 'week' for breaking news, 'month' for recent releases/updates, 'year' for general current info. Omit for no time restriction.",
      },
    },
    required: ["query"],
  },
};

const MIMO_WEB_FETCH_TOOL: AnthropicTool = {
  name: "web_fetch",
  description: "Fetch and read the full content of any webpage via local proxy. Works through network restrictions. Use after web_search to read specific pages in detail.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
    },
    required: ["url"],
  },
};

const MAX_TOOL_ROUNDS = 3;

// ============================================================================
// OpenAI Responses API ↔ Chat Completions conversion
//
// Codex sends Responses API format (input/messages), but upstream providers
// expect Chat Completions format. We convert before sending upstream and
// convert the response back.
// ============================================================================

/** Detect if a request body is in Responses API format (has `input` field) */
function isResponsesAPI(body: Record<string, unknown>): boolean {
  return "input" in body && !("messages" in body);
}

/** Detect images in OpenAI-format bodies (Chat Completions + Responses API) */
function hasOpenAIImages(body: Record<string, unknown>): boolean {
  // Responses API format: input[].content[] with type "input_image"
  const input = body.input as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(input)) {
    for (const item of input) {
      if ((item.type as string) !== "message") continue;
      const content = item.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if ((part.type as string) === "input_image") return true;
      }
    }
  }
  // Chat Completions format: messages[].content[] with type "image_url"
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const t = part.type as string;
        if (t === "image_url" || t === "input_image") return true;
      }
    }
  }
  return false;
}

/** Convert Responses API content parts to Chat Completions format */
function convertContentParts(parts: unknown): unknown {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return parts;
  return parts.map((p: Record<string, unknown>) => {
    if (p.type === "input_text") return { type: "text", text: p.text };
    if (p.type === "output_text") return { type: "text", text: p.text };
    if (p.type === "input_image") return { type: "image_url", image_url: { url: p.image_url } };
    if (p.type === "refusal") return { type: "text", text: p.refusal };
    return p;
  });
}

/** Convert Responses API request to Chat Completions format */
function responsesToChatCompletions(body: Record<string, unknown>): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [];

  // System instructions → system message
  if (body.instructions && typeof body.instructions === "string") {
    messages.push({ role: "system", content: body.instructions });
  }

  // input → user messages
  const input = body.input;
  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        messages.push({ role: "user", content: item });
      } else if (item && typeof item === "object") {
        const role = (item.role as string) || "user";
        if (item.type === "function_call") {
          // Convert Responses API function_call to assistant message with tool_calls
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [{
              id: item.call_id || item.id,
              type: "function",
              function: {
                name: item.name,
                arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? {}),
              },
            }],
          });
        } else if (item.type === "function_call_output") {
          // Convert to tool message
          messages.push({
            role: "tool",
            tool_call_id: item.call_id,
            content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? ""),
          });
        } else if (item.type === "message" && item.content) {
          messages.push({ role, content: convertContentParts(item.content) });
        } else if (item.type === "input_text" && item.text) {
          messages.push({ role, content: item.text });
        } else if (item.type === "input_image" && item.image_url) {
          messages.push({
            role,
            content: [{ type: "image_url", image_url: { url: item.image_url } }],
          });
        } else if (item.type === "reasoning" || item.type === "item_reference") {
          // Skip — Chat Completions has no equivalent, and these are not needed for upstream
        } else if (item.text && item.type !== "function_call" && item.type !== "function_call_output") {
          messages.push({ role, content: item.text });
        } else if (item.content && item.type !== "function_call" && item.type !== "function_call_output") {
          messages.push({ role, content: convertContentParts(item.content) });
        }
      }
    }
  }

  if (messages.length === 0) {
    messages.push({ role: "user", content: "" });
  }

  // Build Chat Completions body
  const chatBody: Record<string, unknown> = {
    model: body.model,
    messages,
    stream: body.stream ?? false,
  };

  // Optional params
  if (body.temperature !== undefined) chatBody.temperature = body.temperature;
  if (body.max_output_tokens !== undefined) chatBody.max_tokens = body.max_output_tokens;
  if (body.top_p !== undefined) chatBody.top_p = body.top_p;
  if (body.stop !== undefined) chatBody.stop = body.stop;

  // Convert tools format: Responses API uses { type: "function", name, ... }
  // Chat Completions uses { type: "function", function: { name, parameters, ... } }
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    const toolTypes = body.tools.map((t: Record<string, unknown>) => t.type);
    log.info("[responses-api] tool types", { types: toolTypes });
    chatBody.tools = body.tools
      .filter((t: Record<string, unknown>) => t.type === "function")
      .map((t: Record<string, unknown>) => {
        return {
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            strict: t.strict,
          },
        };
      });
    const dropped = body.tools.length - (chatBody.tools as Array<unknown>).length;
    if (dropped > 0) log.warn("[responses-api] dropped non-function tools", { count: dropped });
  }

  if (body.tool_choice !== undefined) chatBody.tool_choice = body.tool_choice;
  if (body.parallel_tool_calls !== undefined) chatBody.parallel_tool_calls = body.parallel_tool_calls;

  return chatBody;
}

/** Convert Chat Completions response back to Responses API format */
function chatCompletionsToResponses(
  chatResponse: Record<string, unknown>,
  requestModel: string,
): Record<string, unknown> {
  const choices = chatResponse.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const msg = (choice?.message ?? {}) as Record<string, unknown>;
  const usage = chatResponse.usage as Record<string, number> | undefined;

  // Build output items
  const output: Array<Record<string, unknown>> = [];

  // Message output
  if (msg.content) {
    const content = typeof msg.content === "string"
      ? [{ type: "output_text", text: msg.content }]
      : (Array.isArray(msg.content) ? msg.content as Array<Record<string, unknown>> : [{ type: "output_text", text: String(msg.content) }]);
    output.push({
      type: "message",
      id: `msg_${Date.now().toString(36)}`,
      role: "assistant",
      status: "completed",
      content,
    });
  }

  // Tool calls → function_call output items
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      const fn = tc.function as Record<string, unknown> | undefined;
      output.push({
        type: "function_call",
        id: tc.id || `fc_${Date.now().toString(36)}`,
        call_id: tc.id || `call_${Date.now().toString(36)}`,
        name: fn?.name ?? "unknown",
        arguments: typeof fn?.arguments === "string" ? fn.arguments : JSON.stringify(fn?.arguments ?? {}),
        status: "completed",
      });
    }
  }

  const finishReason = (choice?.finish_reason as string) ?? "stop";
  const responseStatus = finishReason === "tool_calls" ? "requires_action" : "completed";

  const response: Record<string, unknown> = {
    id: `resp_${Date.now().toString(36)}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: requestModel,
    status: responseStatus,
    output,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens: (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
    },
  };

  // If requires_action (tool calls), include required_action
  if (responseStatus === "requires_action") {
    response.required_action = {
      type: "submit_tool_outputs",
      submit_tool_outputs: {
        tool_calls: (msg.tool_calls as Array<Record<string, unknown>>).map((tc) => {
          const fn = tc.function as Record<string, unknown> | undefined;
          return {
            id: tc.id,
            type: "function",
            name: fn?.name,
            arguments: typeof fn?.arguments === "string" ? fn.arguments : JSON.stringify(fn?.arguments ?? {}),
          };
        }),
      },
    };
  }

  return response;
}

/** Convert Responses API tool call results to Chat Completions tool messages */
function toolOutputsToChatMessages(
  toolCalls: Array<Record<string, unknown>>,
  toolOutputs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  // Assistant message with tool calls
  result.push({
    role: "assistant",
    content: null,
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments ?? {}),
      },
    })),
  });

  // Tool result messages
  for (const output of toolOutputs) {
    result.push({
      role: "tool",
      tool_call_id: output.call_id,
      content: typeof output.output === "string" ? output.output : JSON.stringify(output.output ?? ""),
    });
  }

  return result;
}

/**
 * Detect whether a query implies a freshness requirement based on keywords.
 * Returns "week" for breaking/current queries, "month" for recent updates,
 * or undefined for no freshness filter.
 */
function detectFreshness(query: string): "day" | "week" | "month" | "year" | undefined {
  const q = query.toLowerCase();
  if (/今日|今天|today|tonight|now|刚刚|刚才/.test(q)) return "day";
  if (/本周|这周|this week|yesterday|昨天/.test(q)) return "week";
  if (/最新|最新版|最新模型|latest|recent|breaking/.test(q)) return "month";
  if (/今年|this year/.test(q)) return "year";
  return undefined;
}

/**
 * Intercept image blocks inside tool_result content and replace with vision model descriptions.
 *
 * When Claude Code's Read tool reads an image file, the tool_result contains base64 image data.
 * MiMo can't process images, so we send each image to the vision model (e.g. mimo-v2.5) and
 * replace the image block with a text description.
 *
 * Only runs for MiMo models. Non-MiMo models use the existing resolveTarget vision routing.
 *
 * CRITICAL: anthropicToChat filters tool_result content to ONLY text blocks. If we don't
 * replace every image with text here, the image data is silently dropped and MiMo sees nothing.
 */
async function interceptImagesInToolResults(
  body: AnthropicRequest,
  registry: ProviderRegistry,
): Promise<void> {
  const visionResult = registry.findVisionModel();
  if (!visionResult) {
    log.warn("[vision-fallback] no vision model available for tool_result images");
    return;
  }

  const { provider: visionProvider, model: visionModel } = visionResult;
  let totalImages = 0;
  let replacedImages = 0;
  let failedImages = 0;

  for (const msg of body.messages) {
    if (msg.role !== "user") continue;
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (block.type !== "tool_result") continue;
      if (!Array.isArray(block.content)) continue;

      let hasImages = false;
      for (const inner of block.content) {
        if (inner.type === "image") { hasImages = true; break; }
      }
      if (!hasImages) continue;

      // Process each image block in the tool_result
      const newContent: typeof block.content = [];
      for (const inner of block.content) {
        if (inner.type !== "image") {
          newContent.push(inner);
          continue;
        }

        totalImages++;
        const src = inner.source;
        if (!src) {
          log.warn("[vision-fallback] image block has no source, replacing with placeholder");
          newContent.push({ type: "text", text: "[Image description] (image received but source data unavailable)" });
          failedImages++;
          continue;
        }

        const imageUrl = src.type === "base64" && src.data
          ? `data:${src.media_type ?? "image/png"};base64,${src.data}`
          : src.type === "url" && src.url
            ? src.url
            : "";

        if (!imageUrl) {
          log.warn("[vision-fallback] image source has no data/url, replacing with placeholder", {
            sourceType: src.type,
          });
          newContent.push({ type: "text", text: "[Image description] (image received but could not extract source)" });
          failedImages++;
          continue;
        }

        log.info("[vision-fallback] describing image", {
          imageIndex: totalImages,
          visionModel: visionModel.id,
          dataLen: src.type === "base64" ? src.data?.length : undefined,
        });

        const MAX_RETRIES = 2;
        let description = "";
        let lastError = "";

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const visionBody = {
              model: visionModel.id,
              messages: [{
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: imageUrl } },
                  { type: "text", text: "Describe this image in detail. Focus on text content, UI elements, diagrams, and any information that would help someone understand the image without seeing it. Be concise but complete." },
                ],
              }],
              max_tokens: 1024,
              temperature: 0,
            };

            const resp = await callUpstreamChat(
              visionProvider.config.baseUrl,
              visionProvider.config.apiKey,
              visionBody,
              visionProvider.config.wireFormat,
            );

            const choices = (resp as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined;
            description = (choices?.[0]?.message as Record<string, unknown>)?.content as string ?? "";

            if (description) break;

            lastError = "empty description";
            if (attempt < MAX_RETRIES) {
              log.warn("[vision-fallback] empty description, retrying", { imageIndex: totalImages, attempt: attempt + 1 });
            }
          } catch (err) {
            lastError = (err as Error).message;
            if (attempt < MAX_RETRIES) {
              log.warn("[vision-fallback] vision call failed, retrying", { imageIndex: totalImages, attempt: attempt + 1, error: lastError });
            }
          }
        }

        if (description) {
          log.info("[vision-fallback] description received", { chars: description.length, imageIndex: totalImages });
          newContent.push({ type: "text", text: `[Image description] ${description}` });
          replacedImages++;
        } else {
          log.error("[vision-fallback] all retries exhausted", { imageIndex: totalImages, error: lastError });
          newContent.push({ type: "text", text: `[Image description] (vision model failed after ${MAX_RETRIES + 1} attempts: ${lastError.slice(0, 80)})` });
          failedImages++;
        }
      }

      block.content = newContent;
    }
  }

  if (totalImages > 0) {
    log.info("[vision-fallback] summary", {
      total: totalImages,
      replaced: replacedImages,
      failed: failedImages,
      visionModel: visionModel.id,
    });
  }
}

/** Append web_search + web_fetch tools for MiMo, preserving Claude Code native tools.
 *  MiMo uses these for local search/fetch; other tools pass through to Claude Code. */
function injectMiMoTools(body: AnthropicRequest): void {
  // Remove native tools that MiMo can't use:
  // - web_search_20250305: Anthropic server-side search (MiMo can't handle it)
  // - WebSearch: Claude Code native search (goes to Anthropic, not our local engine)
  // - Fetch: Claude Code native fetch (blocked by domain verification in China)
  // Replace with function-style web_search/web_fetch that run locally via mimoToolCallLoop.
  const NATIVE_TOOL_NAMES = new Set(["WebSearch", "Fetch"]);
  const existing = (body.tools ?? []).filter(
    (t) => t.type !== "web_search_20250305" && !NATIVE_TOOL_NAMES.has(t.name),
  );
  body.tools = [...existing, MIMO_WEB_SEARCH_TOOL, MIMO_WEB_FETCH_TOOL];
}

/**
 * Execute a single tool call locally.
 * Returns the tool_result content string.
 */
async function executeLocalTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === "web_search") {
    const query = (input.query as string) || "";
    if (!query) return "Error: empty search query";
    const freshness = input.freshness as "day" | "week" | "month" | "year" | undefined;
    const searchResponse = await hybridSearch(query, { freshness });
    if (searchResponse.results.length === 0) {
      return `No results found for "${query}". Backend: ${searchResponse.backend}.`;
    }
    return searchResponse.results
      .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
      .join("\n\n");
  }
  if (name === "web_fetch") {
    const url = (input.url as string) || "";
    if (!url) return "Error: empty URL";
    try {
      return await fetchWebContent(url);
    } catch (e) {
      return `Failed to fetch ${url}: ${(e as Error).message}`;
    }
  }
  return `Error: unknown tool "${name}"`;
}

/**
 * Tool-call loop for MiMo: call upstream, intercept tool_use calls,
 * execute locally, feed results back, repeat until final answer.
 *
 * Works at the OpenAI level (where MiMo operates) to avoid format
 * conversion overhead during the loop.
 */
interface MimoToolLoopResult {
  response: Record<string, unknown>;
  searchResults: string | null;
}
async function mimoToolCallLoop(
  baseUrl: string,
  apiKey: string,
  chatBody: Record<string, unknown>,
  requestModel: string,
): Promise<MimoToolLoopResult> {
  const messages = chatBody.messages as Array<Record<string, unknown>>;
  let lastResponse: Record<string, unknown> = {};
  let searchResults: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    lastResponse = await callUpstreamChat(baseUrl, apiKey, chatBody);
    const choice = (lastResponse.choices as Array<Record<string, unknown>>)?.[0];
    const msg = (choice?.message ?? {}) as Record<string, unknown>;
    const finishReason = choice?.finish_reason as string;

    // No tool calls — MiMo generated a final answer
    if (finishReason !== "tool_calls" || !Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
      log.info(`[tool-loop] completed in ${round + 1} round(s)`);
      return { response: lastResponse, searchResults };
    }

    // If ANY tool call is not web_search / web_fetch, pass through to Claude Code.
    // Claude Code native tools (Bash, Read, Write, Edit, etc.) must not be intercepted.
    const foreignTool = msg.tool_calls.find((tc: Record<string, unknown>) => {
      const fn = tc.function as Record<string, unknown>;
      const name = fn.name as string;
      return name !== "web_search" && name !== "web_fetch";
    });
    if (foreignTool) {
      log.info(`[tool-loop] passing through native tool: ${(foreignTool.function as Record<string, unknown>).name}`);
      // Strip our injected tools so Claude Code doesn't see unknown tools
      msg.tool_calls = msg.tool_calls.filter((tc: Record<string, unknown>) => {
        const fn = tc.function as Record<string, unknown>;
        const name = fn.name as string;
        return name !== "web_search" && name !== "web_fetch";
      });
      return { response: lastResponse, searchResults };
    }

    log.info(`[tool-loop] round ${round + 1}: ${msg.tool_calls.length} tool call(s)`);

    // Execute each tool call locally
    const toolResults: Array<Record<string, unknown>> = [];
    for (const tc of msg.tool_calls) {
      const fn = tc.function as Record<string, unknown>;
      const toolName = fn.name as string;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse((fn.arguments as string) || "{}"); } catch { log.warn(`[tool-loop] failed to parse args for ${toolName}`); }
      log.info(`[tool-loop] executing ${toolName}(${JSON.stringify(args).slice(0, 100)})`);

      const result = await executeLocalTool(toolName, args);
      log.info(`[tool-loop] ${toolName} returned ${result.length} chars`);

      if (toolName === "web_search" && result.length > 0 && !result.startsWith("Error")) {
        searchResults = result;
      }

      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Append assistant message + tool results to conversation
    messages.push(msg as Record<string, unknown>);
    messages.push(...toolResults);
  }

  // Max rounds reached — MiMo may still be trying to call tools.
  // Execute one last round of tool calls, then force a final answer.
  const choice = (lastResponse.choices as Array<Record<string, unknown>>)?.[0];
  const msg = (choice?.message ?? {}) as Record<string, unknown>;
  const finishReason = choice?.finish_reason as string;

  if (finishReason === "tool_calls" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    // Pass through native Claude Code tools even at max rounds
    const foreignTool = msg.tool_calls.find((tc: Record<string, unknown>) => {
      const fn = tc.function as Record<string, unknown>;
      const name = fn.name as string;
      return name !== "web_search" && name !== "web_fetch";
    });
    if (foreignTool) {
      log.info(`[tool-loop] max rounds, passing through native tool: ${(foreignTool.function as Record<string, unknown>).name}`);
      msg.tool_calls = msg.tool_calls.filter((tc: Record<string, unknown>) => {
        const fn = tc.function as Record<string, unknown>;
        const name = fn.name as string;
        return name !== "web_search" && name !== "web_fetch";
      });
      return { response: lastResponse, searchResults };
    }

    log.warn(`[tool-loop] max rounds (${MAX_TOOL_ROUNDS}) reached, executing final tool calls and forcing answer`);

    const toolResults: Array<Record<string, unknown>> = [];
    for (const tc of msg.tool_calls) {
      const fn = tc.function as Record<string, unknown>;
      const toolName = fn.name as string;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse((fn.arguments as string) || "{}"); } catch { log.warn(`[tool-loop] failed to parse args for ${toolName}`); }
      const result = await executeLocalTool(toolName, args);
      if (toolName === "web_search" && result.length > 0 && !result.startsWith("Error")) {
        searchResults = result;
      }
      toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
    }

    messages.push(msg as Record<string, unknown>);
    messages.push(...toolResults);
    messages.push({ role: "user", content: "Please provide your final answer now, synthesizing all the information you've gathered. Do not call any more tools." });

    lastResponse = await callUpstreamChat(baseUrl, apiKey, chatBody);
  } else {
    log.warn(`[tool-loop] max rounds (${MAX_TOOL_ROUNDS}) reached`);
  }

  return { response: lastResponse, searchResults };
}

// ============================================================================
// Pipeline Execution
// ============================================================================

/**
 * Resolve which provider + model to use for this request.
 *
 * Returns the provider instance, the target model id, and whether vision was used.
 */
function resolveTarget(
  registry: ProviderRegistry,
  protocol: Protocol,
  body: Record<string, unknown>,
): { provider: ProviderInstance; targetModel: string; mainModelId: string; visionModelId: string; usedVision: boolean } {
  const mainProvider = registry.get("main") || registry.available()[0];
  if (!mainProvider) throw new Error("no provider configured");

  const mainModelId = mainProvider.config.defaultModel;
  const hasImages = (protocol === "anthropic" && hasAnthropicImages(body)) ||
    (protocol === "openai" && hasOpenAIImages(body));

  if (hasImages) {
    // Find vision model across ALL providers (not just main)
    const visionResult = registry.findVisionModel(mainProvider.config.id);
    if (visionResult) {
      const visionModelId = visionResult.model.id;
      log.info("visual-fallback", {
        from: mainModelId,
        to: visionModelId,
        provider: visionResult.provider.config.id,
      });
      return {
        provider: visionResult.provider,
        targetModel: visionModelId,
        mainModelId,
        visionModelId,
        usedVision: true,
      };
    }
    // No vision model available — fall back to main with warning
    log.warn("no vision model available, using main model");
  }

  return {
    provider: mainProvider,
    targetModel: mainModelId,
    mainModelId,
    visionModelId: mainModelId,
    usedVision: false,
  };
}

// ============================================================================
// Web Search interception — local hybrid search (Bing/Sogou/Brave)
//
// Used by models WITHOUT native web search (non-MiMo, non-DeepSeek).
// When Claude Code sends web_search_20250305, we execute search locally via
// hybridSearch and return web_search_tool_result blocks directly. The upstream
// model is NOT called for this turn — Claude Code sends a follow-up request
// with the search results for the model to generate the answer.
//
// MiMo: uses native { type: "web_search" } server-side search (skipped here)
// DeepSeek: uses Anthropic endpoint native search (skipped here)
// ============================================================================


/**
 * Resolve the search query from the user message.
 *
 * Strategy: regex-based prefix stripping FIRST (instant, handles ~95% of
 * real-world phrasings). AI extraction is the fallback for edge cases where
 * regex leaves obvious instruction residue (e.g., very unusual phrasing).
 *
 * Reasoning models (MiMo, DeepSeek-R1) spend 2-5s on internal reasoning even
 * for simple extraction tasks, so AI extraction is NOT on the critical path.
 * This is the same approach used by production search engines: rule-based
 * query normalization first, ML-based query understanding when needed.
 */
async function resolveSearchQuery(body: AnthropicRequest): Promise<string> {
  const raw = extractRawQuery(body);
  const cleaned = extractSearchQuery(body);

  // Regex handles the vast majority of cases correctly and instantly.
  // Only fall back to AI when regex clearly failed (output is empty,
  // still contains obvious meta-instruction words).
  const looksClean = cleaned.length >= 2
    && !/^(?:搜索|查询|搜寻|查找|搜一下|搜一搜|查一下|查一查|找一下|找一找|搜|查|找|帮我|请|帮忙|能不能|可以|我想|我要|了解|知道|告诉)/.test(cleaned)
    && cleaned.length <= 200;

  if (looksClean) {
    log.info(`[web-search] "${cleaned.slice(0, 80)}"`);
    return cleaned;
  }

  // Regex couldn't clean it — try AI extraction (adds 2-5s but better than
  // sending garbage to the search engine)
  const aiQuery = await extractQueryWithAI(raw);
  if (aiQuery && aiQuery.length >= 2 && aiQuery.length <= 200) {
    log.info(`[web-search] AI: "${aiQuery.slice(0, 80)}"`);
    return aiQuery;
  }

  // Last resort: use raw or cleaned, whichever looks better
  const fallback = cleaned || raw;
  log.info(`[web-search] fallback: "${fallback.slice(0, 80)}"`);
  return fallback;
}

async function interceptWebSearch(
  body: AnthropicRequest,
  model: string,
  startMs: number,
): Promise<PipelineResult> {
  const query = await resolveSearchQuery(body);
  log.info(`[web-search] "${query.slice(0, 80)}"`);

  const searchResponse = await hybridSearch(query, { freshness: detectFreshness(query) });

  const resultText = searchResponse.results.length > 0
    ? searchResponse.results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n")
    : `No results found for "${query}". Backend: ${searchResponse.backend}.`;

  const response = buildWebSearchResponse(resultText, model);

  return {
    response: response as unknown as Record<string, unknown>,
    protocol: "anthropic",
    usedVision: false,
    visionModelId: model,
    mainModelId: model,
    latencyMs: Date.now() - startMs,
  };
}

async function interceptWebSearchStream(
  body: AnthropicRequest,
  model: string,
  startMs: number,
): Promise<PipelineStreamResult> {
  const query = await resolveSearchQuery(body);
  log.info(`[web-search:stream] "${query.slice(0, 80)}"`);

  const searchResponse = await hybridSearch(query, { freshness: detectFreshness(query) });

  const resultText = searchResponse.results.length > 0
    ? searchResponse.results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n")
    : `No results found for "${query}". Backend: ${searchResponse.backend}.`;

  const response = buildWebSearchResponse(resultText, model);
  const stream = bufferedResponseToSSE(
    response as unknown as Record<string, unknown>,
    model,
    model,
  );

  return {
    protocol: "anthropic",
    usedVision: false,
    visionModelId: model,
    mainModelId: model,
    latencyMs: Date.now() - startMs,
    stream,
  };
}

// ============================================================================
// Web Fetch Response Interception — for ALL models (not just MiMo)
//
// When the model returns a tool_use for web_fetch, Claude Code would normally
// execute it client-side. For users in China, this direct fetch may fail.
// We intercept the response, execute the fetch locally via proxyFetch (which
// uses the system proxy), and return the content directly.
//
// Only intercepts web_fetch tool_use — all other tools pass through.
// Native search (web_search_20250305) is NOT affected.
// ============================================================================

async function interceptWebFetchResponse(
  response: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const content = response.content as Array<Record<string, unknown>> | undefined;
  if (!content?.length) return response;

  const webFetchIndex = content.findIndex(
    (b) => b.type === "tool_use" && b.name === "web_fetch",
  );
  if (webFetchIndex === -1) return response;

  const block = content[webFetchIndex];
  const input = block.input as Record<string, unknown> | undefined;
  const url = (input?.url as string) || (input?.link as string) || "";

  if (!url) {
    log.warn("[web-fetch-intercept] tool_use with empty URL, passing through");
    return response;
  }

  log.info(`[web-fetch-intercept] intercepting fetch for ${url.slice(0, 80)}`);

  try {
    const fetched = await fetchWebContent(url);
    log.info(`[web-fetch-intercept] fetched ${fetched.length} chars from ${url.slice(0, 60)}`);

    const newContent = [...content];
    newContent[webFetchIndex] = {
      type: "tool_result",
      tool_use_id: block.id,
      content: fetched,
    };
    // Preserve tool_use stop_reason if other tool_use blocks remain
    const hasRemainingToolUse = newContent.some((b) => b.type === "tool_use");
    const newStopReason = hasRemainingToolUse ? (response.stop_reason ?? "tool_use") : "end_turn";
    return { ...response, content: newContent, stop_reason: newStopReason };
  } catch (err) {
    log.warn(`[web-fetch-intercept] fetch failed: ${(err as Error).message}`);
    const newContent = [...content];
    newContent[webFetchIndex] = {
      type: "tool_result",
      tool_use_id: block.id,
      content: `Failed to fetch ${url}: ${(err as Error).message}`,
    };
    const hasRemainingToolUse = newContent.some((b) => b.type === "tool_use");
    const newStopReason = hasRemainingToolUse ? (response.stop_reason ?? "tool_use") : "end_turn";
    return { ...response, content: newContent, stop_reason: newStopReason };
  }
}

/**
 * OpenAI format web_fetch interception.
 * Same logic as interceptWebFetchResponse but for OpenAI chat completions format.
 * Tool calls live in choices[0].message.tool_calls, not content[].
 */
async function interceptWebFetchResponseOpenAI(
  response: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const choices = response.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  if (!choice) return response;

  const msg = choice.message as Record<string, unknown> | undefined;
  if (!msg) return response;

  const toolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
  if (!toolCalls?.length) return response;

  const webFetchIdx = toolCalls.findIndex((tc) => {
    const fn = tc.function as Record<string, unknown> | undefined;
    return fn?.name === "web_fetch";
  });
  if (webFetchIdx === -1) return response;

  const tc = toolCalls[webFetchIdx];
  const fn = tc.function as Record<string, unknown>;
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(fn.arguments as string ?? "{}"); } catch {}

  const url = (args.url as string) || (args.link as string) || "";
  if (!url) {
    log.warn("[web-fetch-intercept:openai] tool_call with empty URL, passing through");
    return response;
  }

  log.info(`[web-fetch-intercept:openai] intercepting fetch for ${url.slice(0, 80)}`);

  try {
    const fetched = await fetchWebContent(url);
    log.info(`[web-fetch-intercept:openai] fetched ${fetched.length} chars from ${url.slice(0, 60)}`);

    // Replace the web_fetch tool call with the fetched content as assistant text
    const newToolCalls = toolCalls.filter((_, i) => i !== webFetchIdx);
    const existingText = (msg.content as string) ?? "";
    const newContent = existingText
      ? `${existingText}\n\n[Web content from ${url}]\n${fetched}`
      : `[Web content from ${url}]\n${fetched}`;

    const newMsg: Record<string, unknown> = { ...msg, content: newContent };
    if (newToolCalls.length > 0) {
      newMsg.tool_calls = newToolCalls;
    } else {
      delete newMsg.tool_calls;
    }

    const newChoice = {
      ...choice,
      message: newMsg,
      finish_reason: newToolCalls.length > 0 ? "tool_calls" : "stop",
    };

    return { ...response, choices: [newChoice] };
  } catch (err) {
    log.warn(`[web-fetch-intercept:openai] fetch failed: ${(err as Error).message}`);

    const newToolCalls = toolCalls.filter((_, i) => i !== webFetchIdx);
    const existingText = (msg.content as string) ?? "";
    const errorText = `Failed to fetch ${url}: ${(err as Error).message}`;
    const newContent = existingText ? `${existingText}\n\n${errorText}` : errorText;

    const newMsg: Record<string, unknown> = { ...msg, content: newContent };
    if (newToolCalls.length > 0) {
      newMsg.tool_calls = newToolCalls;
    } else {
      delete newMsg.tool_calls;
    }

    const newChoice = {
      ...choice,
      message: newMsg,
      finish_reason: newToolCalls.length > 0 ? "tool_calls" : "stop",
    };

    return { ...response, choices: [newChoice] };
  }
}

/**
 * Convert a buffered Anthropic response to an SSE stream.
 * Used after the tool-call loop to stream the final response back to Claude Code.
 */

/**
 * Consume an Anthropic SSE stream and reassemble it into a response object.
 * Used to intercept tool_use calls in streaming responses.
 */
async function consumeAnthropicSSE(
  stream: AsyncGenerator<string, void, unknown>,
  requestModel: string,
): Promise<Record<string, unknown>> {
  let msgId = `msg_${Date.now()}`;
  let model = requestModel;
  const content: Array<Record<string, unknown>> = [];
  let stopReason: string | null = null;
  let usage: Record<string, number> = { input_tokens: 0, output_tokens: 0 };

  for await (const chunk of stream) {
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        switch (event.type) {
          case "message_start":
            msgId = event.message?.id ?? msgId;
            model = event.message?.model ?? model;
            usage = event.message?.usage ?? usage;
            break;
          case "content_block_start":
            content[event.index] = { ...event.content_block };
            break;
          case "content_block_delta": {
            const delta = event.delta;
            if (!delta) break;
            const block = content[event.index];
            if (!block) break;
            if (delta.type === "text_delta") {
              block.text = (block.text ?? "") + (delta.text ?? "");
            } else if (delta.type === "input_json_delta") {
              const cur = (block.partial_json as string) ?? "";
              block.partial_json = cur + (delta.partial_json ?? "");
            }
            break;
          }
          case "content_block_stop": {
            const block = content[event.index];
            if (block?.type === "tool_use") {
              const json = (block.partial_json as string) || "{}";
              try { block.input = JSON.parse(json); } catch { block.input = {}; }
              delete block.partial_json;
            }
            break;
          }
          case "message_delta":
            stopReason = event.delta?.stop_reason ?? stopReason;
            usage = { ...usage, output_tokens: event.usage?.output_tokens ?? usage.output_tokens };
            break;
        }
      } catch { /* skip malformed events */ }
    }
  }

  return {
    id: msgId,
    type: "message",
    role: "assistant",
    content,
    model,
    stop_reason: stopReason ?? "end_turn",
    usage,
  };
}

/**
 * Buffer an Anthropic SSE stream, intercept web_fetch if present,
 * and re-stream the (possibly modified) response.
 */
async function* bufferAndInterceptStream(
  rawStream: AsyncGenerator<string, void, unknown>,
  requestModel: string,
  usageRef?: { inputTokens: number; outputTokens: number },
): AsyncGenerator<string, void, unknown> {
  const response = await consumeAnthropicSSE(rawStream, requestModel);

  // Capture usage for metrics
  if (usageRef) {
    const u = response.usage as Record<string, number> | undefined;
    usageRef.inputTokens = u?.input_tokens ?? 0;
    usageRef.outputTokens = u?.output_tokens ?? 0;
  }

  if (!isMiMoModel(requestModel)) {
    const modified = await interceptWebFetchResponse(response);
    yield* bufferedResponseToSSE(modified, requestModel);
  } else {
    yield* bufferedResponseToSSE(response, requestModel);
  }
}

async function* bufferedResponseToSSE(
  response: Record<string, unknown>,
  requestModel: string,
  hintModel?: string,
): AsyncGenerator<string, void, unknown> {
  const msgId = (response.id as string) ?? `msg_${Date.now()}`;
  const model = hintModel || requestModel;

  const emitSSE = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // message_start
  yield emitSSE("message_start", {
    type: "message_start",
    message: {
      id: msgId, type: "message", role: "assistant", content: [],
      model, stop_reason: null,
      usage: response.usage ?? { input_tokens: 0, output_tokens: 0 },
    },
  });
  yield emitSSE("ping", { type: "ping" });

  const content = response.content as Array<Record<string, unknown>> | undefined;
  if (content) {
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type === "text") {
        yield emitSSE("content_block_start", {
          type: "content_block_start", index: i,
          content_block: { type: "text", text: "" },
        });
        yield emitSSE("content_block_delta", {
          type: "content_block_delta", index: i,
          delta: { type: "text_delta", text: block.text },
        });
        yield emitSSE("content_block_stop", { type: "content_block_stop", index: i });
      } else if (block.type === "tool_use") {
        yield emitSSE("content_block_start", {
          type: "content_block_start", index: i,
          content_block: { type: "tool_use", id: block.id, name: block.name, input: {} },
        });
        const inputJson = typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {});
        yield emitSSE("content_block_delta", {
          type: "content_block_delta", index: i,
          delta: { type: "input_json_delta", partial_json: inputJson },
        });
        yield emitSSE("content_block_stop", { type: "content_block_stop", index: i });
      } else if (block.type === "web_search_tool_result") {
        yield emitSSE("content_block_start", {
          type: "content_block_start", index: i,
          content_block: { type: "web_search_tool_result", tool_use_id: block.tool_use_id },
        });
        // Parse "1. **title**\n   url\n   snippet" format into individual results
        const text = (block.content as string) ?? "";
        const entries = text.split(/\n\n+/).filter(Boolean);
        for (const entry of entries) {
          const lines = entry.split("\n").map((l) => l.trim());
          const titleMatch = lines[0]?.match(/^\d+\.\s+\*\*(.+?)\*\*/);
          const title = titleMatch ? titleMatch[1] : lines[0] ?? "";
          const url = lines[1] ?? "";
          const snippet = lines.slice(2).join(" ") ?? "";
          yield emitSSE("content_block_delta", {
            type: "content_block_delta", index: i,
            delta: { type: "web_search_result", url, title, snippet },
          });
        }
        yield emitSSE("content_block_stop", { type: "content_block_stop", index: i });
      }
    }
  }

  const stopReason = response.stop_reason ?? "end_turn";
  const usage = response.usage as Record<string, number> | undefined;
  yield emitSSE("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: usage?.output_tokens ?? 0 },
  });
  yield emitSSE("message_stop", { type: "message_stop" });
}

// ============================================================================
// OpenAI SSE Buffer + Intercept — for fv-codex (OpenAI protocol)
// ============================================================================

/** Parse a single OpenAI SSE data line into a chunk object */
function parseOpenAIStreamChunk(line: string): { done: boolean; chunk: Record<string, unknown> | null } {
  if (!line.startsWith("data: ")) return { done: false, chunk: null };
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return { done: true, chunk: null };
  try { return { done: false, chunk: JSON.parse(payload) as Record<string, unknown> }; }
  catch { return { done: false, chunk: null }; }
}

/**
 * Pass through an OpenAI SSE stream, intercepting web_fetch if present.
 * For normal responses (no tool calls), chunks are yielded directly with zero buffering.
 * Only buffers when finish_reason is "tool_calls" and a web_fetch is detected.
 */
async function* bufferAndInterceptStreamOpenAI(
  rawStream: AsyncGenerator<string, void, unknown>,
): AsyncGenerator<string, void, unknown> {
  let model = "unknown";
  let finishReason: string | null = null;
  let hasWebFetch = false;
  const pendingChunks: string[] = [];
  const toolCallDeltas = new Map<number, { id?: string; name?: string; arguments: string }>();

  for await (const chunk of rawStream) {
    const lines = chunk.split("\n");
    let chunkDone = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      const { done, chunk: parsed } = parseOpenAIStreamChunk(trimmed);
      if (done) {
        finishReason = finishReason ?? "stop";
        chunkDone = true;
        break;
      }
      if (!parsed) continue;

      if (parsed.model && typeof parsed.model === "string") model = parsed.model;

      const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
      if (!choices?.length) continue;

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;
      const reason = (choice.finish_reason ?? parsed.finish_reason) as string | null;
      if (reason) finishReason = reason;

      if (delta) {
        const deltaToolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (deltaToolCalls) {
          for (const tc of deltaToolCalls) {
            const idx = tc.index as number;
            if (!toolCallDeltas.has(idx)) toolCallDeltas.set(idx, { arguments: "" });
            const entry = toolCallDeltas.get(idx)!;
            if (tc.id) entry.id = tc.id as string;
            const fn = tc.function as Record<string, unknown> | undefined;
            if (fn?.name) {
              entry.name = fn.name as string;
              if (fn.name === "web_fetch") hasWebFetch = true;
            }
            if (typeof fn?.arguments === "string") entry.arguments += fn.arguments;
          }
        }
      }
    }

    // Push each raw chunk once (outside inner loop)
    if (chunkDone) {
      pendingChunks.push("data: [DONE]\n\n");
    } else {
      pendingChunks.push(chunk);
    }

    // After seeing finish_reason, check if we need to intercept
    if (finishReason !== null) {
      if (finishReason === "tool_calls" && hasWebFetch) {
        // Need to intercept — yield buffered chunks and replay modified response
        for (const c of pendingChunks) yield c;

        // Assemble tool calls
        const toolCalls: Array<Record<string, unknown>> = [];
        for (const [, entry] of toolCallDeltas) {
          toolCalls.push({
            id: entry.id ?? `call_${Date.now()}`,
            type: "function",
            function: { name: entry.name ?? "unknown", arguments: entry.arguments },
          });
        }

        const message: Record<string, unknown> = { role: "assistant", content: null };
        message.tool_calls = toolCalls;

        const assembled: Record<string, unknown> = {
          id: `chatcmpl_${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, message, finish_reason: "tool_calls" }],
        };

        const intercepted = await interceptWebFetchResponseOpenAI(assembled);
        const finalChoice = (intercepted.choices as Array<Record<string, unknown>>)[0];
        const finalMsg = finalChoice.message as Record<string, unknown>;
        const finalFinish = finalChoice.finish_reason as string;

        if (finalMsg.content) {
          yield `data: ${JSON.stringify({
            id: intercepted.id, object: "chat.completion.chunk", created: intercepted.created, model: intercepted.model,
            choices: [{ index: 0, delta: { role: "assistant", content: finalMsg.content }, finish_reason: null }],
          })}\n\n`;
        }

        const remaining = finalMsg.tool_calls as Array<Record<string, unknown>> | undefined;
        if (remaining?.length) {
          for (let i = 0; i < remaining.length; i++) {
            const tc = remaining[i];
            yield `data: ${JSON.stringify({
              id: intercepted.id, object: "chat.completion.chunk", created: intercepted.created, model: intercepted.model,
              choices: [{ index: 0, delta: { tool_calls: [{ index: i, id: tc.id, type: "function", function: tc.function }] }, finish_reason: null }],
            })}\n\n`;
          }
        }

        yield `data: ${JSON.stringify({
          id: intercepted.id, object: "chat.completion.chunk", created: intercepted.created, model: intercepted.model,
          choices: [{ index: 0, delta: {}, finish_reason: finalFinish }],
        })}\n\n`;
        yield "data: [DONE]\n\n";
      } else {
        // No interception needed — yield everything as-is (already buffered)
        for (const c of pendingChunks) yield c;
      }
      return;
    }
  }

  // Stream ended without finish_reason — yield whatever we have
  for (const c of pendingChunks) yield c;
}

/**
 * Buffer a Chat Completions SSE stream, convert to Responses API format,
 * and re-emit as Responses API SSE events.
 *
 * Used when Codex sends a Responses API request — we convert it to Chat
 * Completions for the upstream, then convert the response back.
 */
async function* bufferChatStreamToResponses(
  rawStream: AsyncGenerator<string, void, unknown>,
  requestModel: string,
  usageRef?: { inputTokens: number; outputTokens: number },
): AsyncGenerator<string, void, unknown> {
  // Buffer the entire Chat Completions stream
  let model = requestModel;
  let finishReason: string | null = null;
  const contentDeltas: string[] = [];
  const toolCallDeltas = new Map<number, { id?: string; name?: string; arguments: string }>();
  let usage: Record<string, number> = { prompt_tokens: 0, completion_tokens: 0 };

  for await (const chunk of rawStream) {
    const lines = chunk.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6).trim();
      if (payload === "[DONE]") { finishReason = finishReason ?? "stop"; continue; }
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        if (parsed.model && typeof parsed.model === "string") model = parsed.model;
        if (parsed.usage) usage = parsed.usage as Record<string, number>;
        const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
        if (!choices?.length) continue;
        const choice = choices[0];
        const delta = choice.delta as Record<string, unknown> | undefined;
        const reason = (choice.finish_reason ?? parsed.finish_reason) as string | null;
        if (reason) finishReason = reason;
        if (delta) {
          if (typeof delta.content === "string") contentDeltas.push(delta.content);
          const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
          if (toolCalls) {
            for (const tc of toolCalls) {
              const idx = tc.index as number;
              if (!toolCallDeltas.has(idx)) toolCallDeltas.set(idx, { arguments: "" });
              const entry = toolCallDeltas.get(idx)!;
              if (tc.id) entry.id = tc.id as string;
              const fn = tc.function as Record<string, unknown> | undefined;
              if (fn?.name) entry.name = fn.name as string;
              if (typeof fn?.arguments === "string") entry.arguments += fn.arguments;
            }
          }
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  if (usageRef) {
    usageRef.inputTokens = usage.prompt_tokens ?? 0;
    usageRef.outputTokens = usage.completion_tokens ?? 0;
  }

  // Build Responses API format
  const output: Array<Record<string, unknown>> = [];
  const fullContent = contentDeltas.join("");
  if (fullContent) {
    output.push({
      type: "message",
      id: `msg_${Date.now().toString(36)}`,
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: fullContent }],
    });
  }
  if (toolCallDeltas.size > 0) {
    for (const [, entry] of toolCallDeltas) {
      output.push({
        type: "function_call",
        id: entry.id || `fc_${Date.now().toString(36)}`,
        call_id: entry.id || `call_${Date.now().toString(36)}`,
        name: entry.name ?? "unknown",
        arguments: entry.arguments,
        status: "completed",
      });
    }
  }

  const respId = `resp_${Date.now().toString(36)}`;
  const created = Math.floor(Date.now() / 1000);
  const responseStatus = finishReason === "tool_calls" ? "requires_action" : "completed";

  // Emit Responses API SSE events
  const emitSSE = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // response.created
  yield emitSSE("response.created", {
    type: "response.created",
    response: {
      id: respId, object: "response", created_at: created,
      model, status: "in_progress", output: [],
    },
  });

  // response.output_item.added + content for message
  if (fullContent) {
    yield emitSSE("response.output_item.added", {
      type: "response.output_item.added",
      output_index: 0,
      item: output[0],
    });
    yield emitSSE("response.content_part.added", {
      type: "response.content_part.added",
      output_index: 0,
      content_index: 0,
      part: { type: "output_text", text: "" },
    });
    yield emitSSE("response.output_text.delta", {
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: fullContent,
    });
    yield emitSSE("response.content_part.done", {
      type: "response.content_part.done",
      output_index: 0,
      content_index: 0,
      part: { type: "output_text", text: fullContent },
    });
    yield emitSSE("response.output_item.done", {
      type: "response.output_item.done",
      output_index: 0,
      item: output[0],
    });
  }

  // Function call items
  let outputIdx = fullContent ? 1 : 0;
  for (const item of output) {
    if (item.type === "function_call") {
      yield emitSSE("response.output_item.added", {
        type: "response.output_item.added",
        output_index: outputIdx,
        item,
      });
      yield emitSSE("response.output_item.done", {
        type: "response.output_item.done",
        output_index: outputIdx,
        item,
      });
      outputIdx++;
    }
  }

  // response.completed
  const completedResponse: Record<string, unknown> = {
    id: respId, object: "response", created_at: created,
    model, status: responseStatus, output,
    usage: {
      input_tokens: usage.prompt_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? 0,
      total_tokens: (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
    },
  };
  if (responseStatus === "requires_action") {
    completedResponse.required_action = {
      type: "submit_tool_outputs",
      submit_tool_outputs: {
        tool_calls: output
          .filter((o) => o.type === "function_call")
          .map((o) => ({
            id: o.call_id || o.id,
            type: "function",
            name: o.name,
            arguments: o.arguments,
          })),
      },
    };
  }
  yield emitSSE("response.completed", {
    type: "response.completed",
    response: completedResponse,
  });
}

// ============================================================================
// Pipeline Execution
// ============================================================================

/**
 * Execute the full request pipeline (non-streaming).
 */
export async function executePipeline(
  registry: ProviderRegistry,
  rawBody: unknown,
  protocol: Protocol,
  _version: string,
): Promise<PipelineResult> {
  const startMs = Date.now();
  const body = rawBody as Record<string, unknown>;
  const requestModel = (body.model as string) || "";

  if (protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;

    // Only MiMo: intercept search locally via tool-call loop
    if (isMiMoModel()) {
      injectMiMoTools(anthropicBody);
      await interceptImagesInToolResults(anthropicBody, registry);
    }
    // All other models: pass through with native search (if available)
  }

  const { provider, targetModel, mainModelId, visionModelId, usedVision } = resolveTarget(registry, protocol, body);

  let response: Record<string, unknown>;

  // MiMo tool-call loop: call MiMo, intercept tool_use, execute locally, re-call
  if (isMiMoModel() && protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;
    let chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = false;
    // Don't call convertToolsForMiMo — injectMiMoTools already filters out
    // web_search_20250305 and injects pure function-style web_search/web_fetch.

    const { response: chatResponse, searchResults } = await mimoToolCallLoop(
      provider.config.baseUrl,
      provider.config.apiKey,
      chatBody,
      requestModel || targetModel,
    );
    response = chatToAnthropic(chatResponse, requestModel || targetModel) as unknown as Record<string, unknown>;
    if (searchResults) {
      const content = (response.content ?? []) as Array<Record<string, unknown>>;
      content.unshift({
        type: "web_search_tool_result",
        tool_use_id: `toolu_${Date.now().toString(36)}`,
        content: searchResults,
      });
      response.content = content;
    }
  } else if (protocol === "anthropic" && provider.config.wireFormat === "anthropic") {
    const anthropicBody = { ...body, model: targetModel } as unknown as AnthropicRequest;
    response = await callUpstreamChat(
      provider.config.baseUrl,
      provider.config.apiKey,
      anthropicBody,
      "anthropic",
    );
  } else if (protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;
    let chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = anthropicBody.stream ?? false;
    const chatResponse = await callUpstreamChat(
      provider.config.baseUrl,
      provider.config.apiKey,
      chatBody,
    );
    response = chatToAnthropic(chatResponse, requestModel || targetModel) as unknown as Record<string, unknown>;
  } else {
    const chatBody = { ...body, model: targetModel };
    if (isResponsesAPI(body)) {
      const converted = responsesToChatCompletions(body);
      converted.model = targetModel;
      log.info("[responses-api] converting to chat completions", {
        input: typeof body.input === "string" ? (body.input as string).slice(0, 80) : "array",
        tools: Array.isArray(body.tools) ? body.tools.length : 0,
      });
      const chatResponse = await callUpstreamChat(
        provider.config.baseUrl,
        provider.config.apiKey,
        converted,
      );
      response = chatCompletionsToResponses(chatResponse, requestModel || targetModel);
    } else {
      response = await callUpstreamChat(
        provider.config.baseUrl,
        provider.config.apiKey,
        chatBody,
      );
    }
  }

  // Intercept web_fetch tool_use for ALL non-MiMo models.
  // Executes fetch locally via proxyFetch so it works through the user's proxy.
  if (!isMiMoModel(requestModel)) {
    response = protocol === "openai"
      ? await interceptWebFetchResponseOpenAI(response)
      : await interceptWebFetchResponse(response);
  }

  log.info("pipeline completed", {
    inputModel: requestModel,
    targetModel,
    hasImages: usedVision,
    vision: usedVision,
    provider: provider.config.id,
    wireFormat: provider.config.wireFormat,
  });

  return {
    response,
    protocol,
    usedVision,
    visionModelId,
    mainModelId,
    latencyMs: Date.now() - startMs,
  };
}

/**
 * Execute the streaming pipeline.
 *
 * For MiMo: tool-call loop requires buffering (can't stream mid-loop).
 * The first MiMo response is buffered to check for tool_use calls.
 * If tools are found, execute locally and re-call (up to MAX_TOOL_ROUNDS).
 * The final response is converted to SSE stream for Claude Code.
 */
export async function executePipelineStream(
  registry: ProviderRegistry,
  rawBody: unknown,
  protocol: Protocol,
  _version: string,
): Promise<PipelineStreamResult> {
  const startMs = Date.now();
  const body = rawBody as Record<string, unknown>;
  const requestModel = (body.model as string) || "";

  if (protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;

    // Only MiMo: intercept search locally via tool-call loop
    if (isMiMoModel()) {
      injectMiMoTools(anthropicBody);
      await interceptImagesInToolResults(anthropicBody, registry);
    }
    // All other models: pass through with native search (if available)
  }

  const { provider, targetModel, mainModelId, visionModelId, usedVision } = resolveTarget(registry, protocol, body);

  let stream: AsyncGenerator<string, void, unknown>;
  const usageRef = { inputTokens: 0, outputTokens: 0 };

  // MiMo: buffer response to handle tool-call loop, then stream final answer
  if (isMiMoModel() && protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;
    let chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = false; // Buffer for tool-call loop

    const { response: chatResponse, searchResults } = await mimoToolCallLoop(
      provider.config.baseUrl,
      provider.config.apiKey,
      chatBody,
      requestModel || targetModel,
    );
    const anthropicResponse = chatToAnthropic(chatResponse, requestModel || targetModel) as unknown as Record<string, unknown>;
    if (searchResults) {
      const content = (anthropicResponse.content ?? []) as Array<Record<string, unknown>>;
      content.unshift({
        type: "web_search_tool_result",
        tool_use_id: `toolu_${Date.now().toString(36)}`,
        content: searchResults,
      });
      anthropicResponse.content = content;
    }
    // Capture MiMo usage from chat response
    const u = (chatResponse as Record<string, unknown>).usage as Record<string, number> | undefined;
    usageRef.inputTokens = u?.prompt_tokens ?? 0;
    usageRef.outputTokens = u?.completion_tokens ?? 0;
    stream = bufferedResponseToSSE(
      anthropicResponse as unknown as Record<string, unknown>,
      requestModel || targetModel,
      targetModel,
    );
  } else if (protocol === "anthropic" && provider.config.wireFormat === "anthropic") {
    // Anthropic SSE stream → buffer → intercept web_fetch → re-stream
    const rawStream = callUpstreamChatStreaming(
      provider.config.baseUrl,
      provider.config.apiKey,
      { ...body, model: targetModel },
      "anthropic",
    );
    stream = bufferAndInterceptStream(rawStream, requestModel || targetModel, usageRef);
  } else if (protocol === "anthropic") {
    // OpenAI SSE → Anthropic SSE → buffer → intercept web_fetch → re-stream
    const anthropicBody = body as unknown as AnthropicRequest;
    let chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = true;
    const upstreamStream = callUpstreamChatStreaming(
      provider.config.baseUrl,
      provider.config.apiKey,
      chatBody,
    );
    const anthropicStream = openaiSSEToAnthropicSSE(upstreamStream, requestModel || targetModel, undefined, targetModel);
    stream = bufferAndInterceptStream(anthropicStream, requestModel || targetModel, usageRef);
  } else if (isResponsesAPI(body)) {
    // Responses API → Chat Completions → upstream → convert response back
    const converted = responsesToChatCompletions(body);
    converted.model = targetModel;
    converted.stream = true;
    log.info("[responses-api:stream] converting to chat completions", {
      input: typeof body.input === "string" ? (body.input as string).slice(0, 80) : "array",
      tools: Array.isArray(body.tools) ? body.tools.length : 0,
    });
    const rawStream = callUpstreamChatStreaming(
      provider.config.baseUrl,
      provider.config.apiKey,
      converted,
    );
    // Buffer the Chat Completions stream, convert to Responses API format, re-emit
    stream = bufferChatStreamToResponses(rawStream, requestModel || targetModel, usageRef);
  } else {
    const chatBody = { ...body, model: targetModel, stream: true };
    const rawStream = callUpstreamChatStreaming(
      provider.config.baseUrl,
      provider.config.apiKey,
      chatBody,
    );
    // Buffer and intercept web_fetch for non-MiMo models in OpenAI format
    stream = isMiMoModel() ? rawStream : bufferAndInterceptStreamOpenAI(rawStream);
  }

  return {
    protocol,
    usedVision,
    visionModelId,
    mainModelId,
    latencyMs: Date.now() - startMs,
    stream,
    usage: usageRef,
  };
}
