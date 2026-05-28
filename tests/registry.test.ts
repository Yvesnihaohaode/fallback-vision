import { describe, expect, it, beforeEach } from "vitest";
import { ProviderRegistry } from "../src/providers/registry.js";
import type { ProviderConfig } from "../src/types.js";

const mimoConfig: ProviderConfig = {
  id: "mimo",
  displayName: "MiMo",
  baseUrl: "https://api.xiaomimimo.com/v1",
  apiKey: "sk-test",
  defaultModel: "mimo-v2.5-pro",
  wireFormat: "openai",
  priority: 1,
  models: [
    {
      id: "mimo-v2.5-pro",
      displayName: "MiMo V2.5 Pro",
      providerId: "mimo",
      capabilities: { vision: false, tools: true, reasoning: true, streaming: true },
      contextWindow: 1_000_000,
      maxOutputTokens: 131_072,
    },
    {
      id: "mimo-v2.5",
      displayName: "MiMo V2.5 (Vision)",
      providerId: "mimo",
      capabilities: { vision: true, tools: true, reasoning: true, streaming: true },
      contextWindow: 1_000_000,
      maxOutputTokens: 32_768,
    },
  ],
};

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it("registers and retrieves a provider", () => {
    registry.register(mimoConfig);
    const p = registry.get("mimo");
    expect(p).toBeDefined();
    expect(p!.config.displayName).toBe("MiMo");
  });

  it("returns undefined for unknown provider", () => {
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("lists all providers", () => {
    registry.register(mimoConfig);
    expect(registry.all()).toHaveLength(1);
  });

  it("filters available providers", () => {
    registry.register(mimoConfig);
    expect(registry.available()).toHaveLength(1);

    registry.register({ ...mimoConfig, id: "no-key", apiKey: "" });
    expect(registry.available()).toHaveLength(1);
  });

  it("finds provider by model id", () => {
    registry.register(mimoConfig);
    const p = registry.findByModel("mimo-v2.5-pro");
    expect(p?.config.id).toBe("mimo");
  });

  it("returns undefined for unknown model", () => {
    registry.register(mimoConfig);
    expect(registry.findByModel("gpt-4o")).toBeUndefined();
  });

  it("finds vision model in preferred provider first", () => {
    registry.register(mimoConfig);
    const result = registry.findVisionModel("mimo");
    expect(result?.model.id).toBe("mimo-v2.5");
    expect(result?.provider.config.id).toBe("mimo");
  });

  it("falls back to other providers for vision model", () => {
    registry.register(mimoConfig);
    const result = registry.findVisionModel("other");
    expect(result?.model.capabilities.vision).toBe(true);
  });

  it("returns null when no vision model available", () => {
    registry.register({ ...mimoConfig, models: [mimoConfig.models[0]] });
    const result = registry.findVisionModel();
    expect(result).toBeNull();
  });

  it("removes a provider", () => {
    registry.register(mimoConfig);
    expect(registry.remove("mimo")).toBe(true);
    expect(registry.get("mimo")).toBeUndefined();
  });

  it("clears all providers", () => {
    registry.register(mimoConfig);
    registry.clear();
    expect(registry.all()).toHaveLength(0);
  });
});
