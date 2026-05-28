import type { ModelInfo, ProviderConfig, ProviderInstance } from "../types.js";
import { BaseProvider } from "./base.js";

/**
 * Provider Registry — manages all configured providers.
 * Supports dynamic registration, lookup by id, and discovery of vision models.
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderInstance> = new Map();

  register(config: ProviderConfig): ProviderInstance {
    const provider = new BaseProvider(config);
    this.providers.set(config.id, provider);
    return provider;
  }

  get(id: string): ProviderInstance | undefined {
    return this.providers.get(id);
  }

  all(): ProviderInstance[] {
    return [...this.providers.values()];
  }

  available(): ProviderInstance[] {
    return this.all().filter((p) => p.isAvailable());
  }

  /**
   * Find which provider owns a given model id.
   */
  findByModel(modelId: string): ProviderInstance | undefined {
    for (const p of this.providers.values()) {
      if (p.getModel(modelId)) return p;
    }
    return undefined;
  }

  /**
   * Find any available vision model across all providers.
   * Prefers the same provider, then falls back to others.
   */
  findVisionModel(preferredProviderId?: string): { provider: ProviderInstance; model: ModelInfo } | null {
    // Same provider first
    if (preferredProviderId) {
      const preferred = this.providers.get(preferredProviderId);
      if (preferred?.isAvailable()) {
        const visionModel = preferred.hasVisionModel();
        if (visionModel) return { provider: preferred, model: visionModel };
      }
    }

    // Cross-provider fallback
    for (const p of this.providers.values()) {
      if (!p.isAvailable()) continue;
      const visionModel = p.hasVisionModel();
      if (visionModel) return { provider: p, model: visionModel };
    }

    return null;
  }

  remove(id: string): boolean {
    return this.providers.delete(id);
  }

  clear(): void {
    this.providers.clear();
  }
}
