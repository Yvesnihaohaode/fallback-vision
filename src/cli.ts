import { loadConfig } from "./config/loader.js";
import { startServer } from "./server.js";
import { setVerbose, log } from "./util/logger.js";

const args = process.argv.slice(2);
const parsed = {
  port: undefined as number | undefined,
  host: undefined as string | undefined,
  verbose: false,
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--port" || a === "-p") {
    parsed.port = Number(args[++i]);
  } else if (a === "--host") {
    parsed.host = args[++i];
  } else if (a === "--verbose" || a === "-v") {
    parsed.verbose = true;
  } else if (a === "--help" || a === "-h") {
    console.log(`
fallback-vision — AI Gateway with Visual Fallback

Usage:
  fallback-vision [options]

Options:
  --port, -p <port>    Listen port (default: 8789)
  --host <host>        Listen host (default: 127.0.0.1)
  --verbose, -v        Enable debug logging
  --help, -h           Show this help

Environment Variables:
  MIMO_API_KEY         MiMo API key
  DEEPSEEK_API_KEY     DeepSeek API key (or DS_API_KEY)
  OPENAI_API_KEY       OpenAI API key
  FALLBACK_VISION_PORT     Default port
  FALLBACK_VISION_HOST     Default host
  FALLBACK_VISION_VERBOSE  Enable verbose logging
`);
    process.exit(0);
  }
}

setVerbose(parsed.verbose);

const cfg = loadConfig(parsed);

const server = startServer(cfg);

const providers = cfg.registry.available();
log.info(`fallback-vision v${cfg.version} listening on ${cfg.host}:${cfg.port}`);
log.info(`registered providers: ${providers.map((p) => p.config.id).join(", ") || "(none)"}`);
log.info(`routing strategy: ${cfg.routingStrategy}`);
log.info(`dashboard: http://${cfg.host}:${cfg.port}/`);
