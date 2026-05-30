// ============================================================================
// Request Pipeline — single entry point for all model routing
//
// Flow:
// 1. Resolve main provider (always the user-configured main model)
// 2. Check if request contains images → if yes, route to vision provider
// 3. Convert Anthropic → OpenAI if needed
// 4. Call upstream with correct provider config
// 5. Convert response back to Anthropic if needed
// ============================================================================

import { ProviderRegistry } from "../providers/registry.js";
import { anthropicToChat, chatToAnthropic, hasAnthropicImages, openaiSSEToAnthropicSSE, type AnthropicRequest } from "../translate/anthropic.js";
import { callUpstreamChat, callUpstreamChatStreaming } from "./upstream.js";
import { log } from "../util/logger.js";
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
  const hasImages = protocol === "anthropic" && hasAnthropicImages(body);

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

  const { provider, targetModel, mainModelId, visionModelId, usedVision } = resolveTarget(registry, protocol, body);

  // Convert to OpenAI format if Anthropic
  let chatBody: Record<string, unknown>;
  if (protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;
    chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = anthropicBody.stream ?? false;
  } else {
    chatBody = { ...body, model: targetModel };
  }

  // Call upstream with the resolved provider's config
  const chatResponse = await callUpstreamChat(
    provider.config.baseUrl,
    provider.config.apiKey,
    chatBody,
  );

  // Convert back if Anthropic
  let response: Record<string, unknown>;
  if (protocol === "anthropic") {
    response = chatToAnthropic(chatResponse, requestModel || targetModel) as unknown as Record<string, unknown>;
  } else {
    response = chatResponse;
  }

  log.info("pipeline completed", {
    inputModel: requestModel,
    targetModel,
    hasImages: usedVision,
    vision: usedVision,
    provider: provider.config.id,
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

  const { provider, targetModel, mainModelId, visionModelId, usedVision } = resolveTarget(registry, protocol, body);

  // Convert to OpenAI format
  let chatBody: Record<string, unknown>;
  if (protocol === "anthropic") {
    const anthropicBody = body as unknown as AnthropicRequest;
    chatBody = anthropicToChat(anthropicBody);
    chatBody.model = targetModel;
    chatBody.stream = true;
  } else {
    chatBody = { ...body, model: targetModel, stream: true };
  }

  // Get SSE stream from upstream using the resolved provider's config
  const upstreamStream = callUpstreamChatStreaming(
    provider.config.baseUrl,
    provider.config.apiKey,
    chatBody,
  );

  // Convert stream if Anthropic protocol
  let stream: AsyncGenerator<string, void, unknown>;
  if (protocol === "anthropic") {
    stream = openaiSSEToAnthropicSSE(upstreamStream, requestModel || targetModel, undefined, targetModel);
  } else {
    stream = upstreamStream;
  }

  return {
    protocol,
    usedVision,
    visionModelId,
    mainModelId,
    latencyMs: Date.now() - startMs,
    stream,
  };
}
