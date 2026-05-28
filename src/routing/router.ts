import type { GatewayRequest, RoutingDecision } from "../types.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { detectImages } from "./capability.js";
import { log } from "../util/logger.js";

/**
 * Router — 2-model visual fallback engine.
 *
 * Flow:
 *   1. Detect images in request
 *   2. If images → route to vision model
 *   3. If no images → route to main model
 */
export class Router {
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  route(request: GatewayRequest): RoutingDecision {
    const hasImages = detectImages(request);
    request.hasImages = hasImages;

    const mainProvider = this.registry.get("main");
    const visionProvider = this.registry.get("vision");

    if (hasImages) {
      // Images detected → use vision model
      if (visionProvider?.isAvailable()) {
        const model = visionProvider.getModel(visionProvider.config.defaultModel);
        if (model) {
          log.info(`[visual-fallback] ${request.model} → ${model.id} (image detected)`);
          return {
            provider: visionProvider,
            model,
            reason: "visual-fallback",
            fallbackFrom: request.model,
          };
        }
      }
      // No vision model available, try main model anyway
      log.warn("[visual-fallback] no vision model available, using main model");
    }

    // No images, or no vision model → use main model
    if (mainProvider?.isAvailable()) {
      const model = mainProvider.getModel(mainProvider.config.defaultModel);
      if (model) {
        return {
          provider: mainProvider,
          model,
          reason: "direct",
        };
      }
    }

    throw new Error("no model available — configure API keys in Settings");
  }
}
