import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadSettings, saveSettings, detectModelCapabilities } from "../src/config/settings.js";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const testDir = join(homedir(), ".fallback-vision-test");
const testFile = join(testDir, "settings.json");

describe("Settings", () => {
  beforeEach(() => {
    if (existsSync(testFile)) rmSync(testFile);
  });

  afterEach(() => {
    if (existsSync(testFile)) rmSync(testFile);
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it("loadSettings returns defaults when no file", () => {
    // The real settings path is ~/.fallback-vision/settings.json
    // This test just verifies the function works
    const settings = loadSettings();
    expect(settings).toHaveProperty("clientType");
    expect(settings).toHaveProperty("mainModel");
    expect(settings).toHaveProperty("visionModel");
  });

  it("saveSettings writes file and loadSettings reads it back", () => {
    const settings = loadSettings();
    settings.clientType = "claude";
    settings.mainModel.providerName = "TestProvider";
    saveSettings(settings);

    const reloaded = loadSettings();
    expect(reloaded.clientType).toBe("claude");
    expect(reloaded.mainModel.providerName).toBe("TestProvider");
  });
});

describe("detectModelCapabilities", () => {
  it("detects known MiMo models", () => {
    expect(detectModelCapabilities("mimo-v2.5-pro")).toEqual({
      vision: false, reasoning: true, description: expect.any(String), known: true,
    });
    expect(detectModelCapabilities("mimo-v2.5")).toEqual({
      vision: true, reasoning: true, description: expect.any(String), known: true,
    });
  });

  it("detects known OpenAI models", () => {
    expect(detectModelCapabilities("gpt-4o")).toEqual({
      vision: true, reasoning: true, description: expect.any(String), known: true,
    });
  });

  it("detects known Claude models", () => {
    expect(detectModelCapabilities("claude-sonnet-4-20250514")).toEqual({
      vision: true, reasoning: true, description: expect.any(String), known: true,
    });
  });

  it("heuristic for unknown models with vision keyword", () => {
    const result = detectModelCapabilities("my-vision-model-v2");
    expect(result.vision).toBe(true);
    expect(result.known).toBe(false);
  });

  it("heuristic for unknown models with reasoning keyword", () => {
    const result = detectModelCapabilities("my-reasoning-model");
    expect(result.reasoning).toBe(true);
    expect(result.known).toBe(false);
  });

  it("unknown model with no hints", () => {
    const result = detectModelCapabilities("random-model");
    expect(result.vision).toBe(false);
    expect(result.reasoning).toBe(false);
    expect(result.known).toBe(false);
  });
});
