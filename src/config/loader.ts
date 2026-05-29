import type { ProviderConfig, RoutingStrategy } from "../types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { loadSettings, type ModelSlot } from "./settings.js";
import { log } from "../util/logger.js";

export interface GatewayConfig {
  host: string;
  port: number;
  version: string;
  registry: ProviderRegistry;
  routingStrategy: RoutingStrategy;
  dashboardEnabled: boolean;
  verbose: boolean;
}

const DEFAULTS = {
  host: "127.0.0.1",
  port: 8789,
};

function slotToProviderConfig(slot: ModelSlot, id: string, priority: number): ProviderConfig {
  const vision = id === "vision";
  return {
    id,
    displayName: slot.providerName,
    baseUrl: slot.baseUrl,
    apiKey: slot.apiKey,
    defaultModel: slot.modelName,
    wireFormat: "openai",
    priority,
    models: [{
      id: slot.modelName,
      displayName: slot.modelName,
      providerId: id,
      capabilities: {
        vision,
        tools: true,
        reasoning: false,
        streaming: true,
      },
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
    }],
  };
}

export function loadConfig(args: { port?: number; host?: string; verbose?: boolean }): GatewayConfig {
  const registry = new ProviderRegistry();
  const settings = loadSettings();

  if (settings.mainModel.apiKey) {
    registry.register(slotToProviderConfig(settings.mainModel, "main", 1));
    log.info(`main model: ${settings.mainModel.providerName} / ${settings.mainModel.modelName}`);
  } else {
    log.warn("main model: no API key configured");
  }

  if (settings.visionModel.apiKey) {
    registry.register(slotToProviderConfig(settings.visionModel, "vision", 2));
    log.info(`vision model: ${settings.visionModel.providerName} / ${settings.visionModel.modelName}`);
  } else {
    log.warn("vision model: no API key configured");
  }

  const port = args.port ?? (process.env.FALLBACK_VISION_PORT ? Number(process.env.FALLBACK_VISION_PORT) : undefined) ?? DEFAULTS.port;
  const host = args.host ?? process.env.FALLBACK_VISION_HOST ?? DEFAULTS.host;
  const verbose = args.verbose ?? !!process.env.FALLBACK_VISION_VERBOSE;

  return {
    host,
    port,
    version: "0.3.2",
    registry,
    routingStrategy: "balanced",
    dashboardEnabled: process.env.FALLBACK_VISION_NO_DASHBOARD !== "1",
    verbose,
  };
}
