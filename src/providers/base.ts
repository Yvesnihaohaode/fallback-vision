import type { ModelInfo, ProviderConfig, ProviderInstance } from "../types.js";

/**
 * Base provider implementation. Each provider wraps a config and provides
 * model lookup, vision model discovery, and availability checks.
 */
export class BaseProvider implements ProviderInstance {
  config: ProviderConfig;
  private modelMap: Map<string, ModelInfo>;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.modelMap = new Map();
    for (const m of config.models) {
      this.modelMap.set(m.id, m);
    }
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  getModel(modelId: string): ModelInfo | undefined {
    return this.modelMap.get(modelId);
  }

  hasVisionModel(): ModelInfo | undefined {
    return this.config.models.find(
      (m) => m.capabilities.vision && !m.deprecatedAfter
    );
  }
}
