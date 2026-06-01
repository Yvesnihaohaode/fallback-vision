// ============================================================================
// Proxy-aware fetch — auto-detects local proxy (FlClash/Clash/V2Ray)
//
// macOS system proxy is NOT respected by Node.js fetch(). This wrapper
// detects common local proxy ports and routes requests through them.
// Falls back to direct connection if no proxy is found.
//
// Usage: proxyFetch(url, init, { proxy: true }) — use for blocked sites (Brave)
//        proxyFetch(url, init) — direct connection (Bing, Sogou)
// ============================================================================

import { log } from "../util/logger.js";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const LOCAL_PROXY_PORTS = [7890, 7891, 1080, 8080];
const CONNECT_TIMEOUT_MS = 1500;

let detectedProxyUrl: string | null | undefined; // undefined = not checked yet

async function findLocalProxy(): Promise<string | null> {
  if (detectedProxyUrl !== undefined) return detectedProxyUrl;

  for (const port of LOCAL_PROXY_PORTS) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
      // Any response (even error) means the port is open
      detectedProxyUrl = `http://127.0.0.1:${port}`;
      log.info(`[proxy-fetch] detected local proxy at ${detectedProxyUrl}`);
      return detectedProxyUrl;
    } catch {
      // Port not open, try next
    }
  }

  detectedProxyUrl = null;
  log.info("[proxy-fetch] no local proxy detected, using direct connection");
  return null;
}

export async function proxyFetch(
  url: string,
  init?: RequestInit,
  opts?: { proxy?: boolean },
): Promise<Response> {
  if (!opts?.proxy) {
    // Direct connection (default)
    return fetch(url, init);
  }

  // Proxy mode — required for blocked sites (Brave API)
  const proxyUrl = await findLocalProxy();

  if (!proxyUrl) {
    log.warn("[proxy-fetch] proxy requested but no local proxy found, falling back to direct");
    return fetch(url, init);
  }

  // Use undici's ProxyAgent + fetch (Node.js native fetch doesn't support dispatcher)
  const dispatcher = new ProxyAgent(proxyUrl);

  return undiciFetch(url, {
    ...init,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1] & { dispatcher: ProxyAgent }) as unknown as Response;
}
