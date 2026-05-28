import { describe, expect, it, beforeEach } from "vitest";
import { ProviderRegistry } from "../src/providers/registry.js";
import { Router } from "../src/routing/router.js";
import type { GatewayRequest, ProviderConfig } from "../src/types.js";

const mainConfig: ProviderConfig = {
  id: "main",
  displayName: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "sk-test",
  defaultModel: "deepseek-v4-pro",
  wireFormat: "openai",
  priority: 1,
  models: [{
    id: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    providerId: "main",
    capabilities: { vision: false, tools: true, reasoning: true, streaming: true },
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
  }],
};

const visionConfig: ProviderConfig = {
  id: "vision",
  displayName: "MiMo",
  baseUrl: "https://api.xiaomimimo.com/v1",
  apiKey: "sk-test",
  defaultModel: "mimo-v2.5",
  wireFormat: "openai",
  priority: 2,
  models: [{
    id: "mimo-v2.5",
    displayName: "MiMo V2.5 (Vision)",
    providerId: "vision",
    capabilities: { vision: true, tools: true, reasoning: true, streaming: true },
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
  }],
};

function makeReq(model: string, raw: unknown): GatewayRequest {
  return { format: "responses", model, stream: false, hasImages: false, hasTools: false, messages: [], raw };
}

describe("Router", () => {
  let registry: ProviderRegistry;
  let router: Router;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(mainConfig);
    registry.register(visionConfig);
    router = new Router(registry);
  });

  it("routes to main model when no images", () => {
    const req = makeReq("deepseek-v4-pro", { input: [{ type: "message", content: [{ type: "input_text", text: "hello" }] }] });
    const decision = router.route(req);
    expect(decision.provider.config.id).toBe("main");
    expect(decision.model.id).toBe("deepseek-v4-pro");
    expect(decision.reason).toBe("direct");
    expect(decision.fallbackFrom).toBeUndefined();
  });

  it("routes to vision model when image detected", () => {
    const req = makeReq("deepseek-v4-pro", {
      input: [{
        type: "message",
        content: [
          { type: "input_text", text: "describe this" },
          { type: "input_image", image_url: "data:image/png;base64,..." },
        ],
      }],
    });
    const decision = router.route(req);
    expect(decision.provider.config.id).toBe("vision");
    expect(decision.model.id).toBe("mimo-v2.5");
    expect(decision.reason).toBe("visual-fallback");
    expect(decision.fallbackFrom).toBe("deepseek-v4-pro");
  });

  it("routes to vision model in chat-completions format", () => {
    const req: GatewayRequest = {
      format: "chat-completions",
      model: "deepseek-v4-pro",
      stream: false,
      hasImages: false,
      hasTools: false,
      messages: [],
      raw: {
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "image_url", image_url: { url: "https://example.com/img.png" } },
          ],
        }],
      },
    };
    const decision = router.route(req);
    expect(decision.provider.config.id).toBe("vision");
    expect(decision.reason).toBe("visual-fallback");
  });

  it("falls back to main model when no vision model configured", () => {
    const localRegistry = new ProviderRegistry();
    localRegistry.register(mainConfig);
    const localRouter = new Router(localRegistry);

    const req = makeReq("deepseek-v4-pro", {
      input: [{
        type: "message",
        content: [
          { type: "input_text", text: "what is this?" },
          { type: "input_image", image_url: "data:image/png;base64,..." },
        ],
      }],
    });
    const decision = localRouter.route(req);
    expect(decision.provider.config.id).toBe("main");
    expect(decision.reason).toBe("direct");
  });

  it("throws when no providers configured", () => {
    const emptyRegistry = new ProviderRegistry();
    const emptyRouter = new Router(emptyRegistry);
    const req = makeReq("any-model", {});
    expect(() => emptyRouter.route(req)).toThrow("no model available");
  });

  it("detects multiple images", () => {
    const req = makeReq("deepseek-v4-pro", {
      input: [{
        type: "message",
        content: [
          { type: "input_text", text: "compare these" },
          { type: "input_image", image_url: "data:image/png;base64,aaa" },
          { type: "input_image", image_url: "data:image/png;base64,bbb" },
        ],
      }],
    });
    const decision = router.route(req);
    expect(decision.reason).toBe("visual-fallback");
  });
});
