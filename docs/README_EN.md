<h1 align="center">⚡ Fallback Vision</h1>

<p align="center">
  <strong>AI Gateway with Visual Fallback, Hybrid Search & Protocol Translation</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/fallback-vision"><img alt="npm" src="https://img.shields.io/badge/npm-v0.6.0-blue"></a>
  <a href="https://github.com/Yvesnihaohaode/fallback-vision/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/Yvesnihaohaode/fallback-vision"></a>
  <a href="https://github.com/Yvesnihaohaode/fallback-vision"><img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen"></a>
</p>

<p align="center">
  <a href="../README.md">中文</a> | <strong>English</strong>
</p>

---

## What is it

Fallback Vision is an **AI gateway** that sits between your app and AI models, solving three core problems:

1. **Text-only models can't see images** → Auto-routes images to a vision model, passes the description to the main model for reasoning
2. **Claude Code / Codex don't work with MiMo search** → Local hybrid search engine with 4 backends racing in parallel
3. **Anthropic and OpenAI protocols are incompatible** → Automatic bidirectional translation, one gateway for both protocols

```
Your App → Fallback Vision → Image detected? → Vision model analyzes → Main model reasons → Response
                         → Search request?  → 4 backends race      → Fastest result wins
                         → Different protocol? → Auto-translate     → Upstream model
```

## Core Features

### Visual Fallback Routing
Your main model doesn't support multimodal? No problem. Fallback Vision automatically detects images, calls a vision model for structured analysis, then passes the description to the main model. **The main model never sees the raw image — only the analysis.**

Supported main models: MiMo, DeepSeek, OpenAI, Claude, Gemini, Qwen — any OpenAI-compatible API.

### Hybrid Search Engine
MiMo doesn't support Claude Code's `web_search` / `web_fetch`? Fallback Vision races 4 search backends (**Bing / Sogou / Brave / Google**) in parallel — the fastest result wins.

- **Freshness filtering**: `day` / `week` / `month` — no more outdated search results
- **Smart enhancement**: Queries with "latest" keywords automatically enable freshness filtering
- **Proxy-friendly**: Works in any network environment

### Protocol Translation
Claude Code sends Anthropic format, Codex sends OpenAI format — Fallback Vision auto-translates bidirectionally. Full streaming SSE support.

### One-Command Launch
```bash
fv-claude   # Start service + configure Claude Code + open claude
fv-codex    # Start service + configure Codex + open codex
fv-stop     # Stop service + restore original config
```

### cc-switch Integration
`fv-claude` automatically backs up your Claude config (cc-switch, etc.) on start. `fv-stop` restores it on shutdown. No disruption to your existing setup.

## Quick Start

### npm (recommended)

```bash
npm install -g fallback-vision
fv-claude    # Claude Code mode
fv-codex     # Codex mode
```

### Docker

```bash
docker run -d -p 8789:8789 \
  -v ~/.fallback-vision:/root/.fallback-vision \
  yvesnihaohaode/fallback-vision:latest
```

### From source

```bash
git clone https://github.com/Yvesnihaohaode/fallback-vision.git
cd fallback-vision
npm install
npm run build
node bin/fv-claude.js
```

All methods auto-open the Web UI (http://127.0.0.1:8789) for API configuration.

## Configuration

Open http://127.0.0.1:8789 in your browser for the Web Dashboard:

| Setting | Description |
|---------|-------------|
| Client type | Codex (OpenAI) or Claude Code (Anthropic) |
| Main model | Provider + API Key + Base URL + Model name |
| Vision model | Provider + API Key + Base URL + Model name |
| Local search | MiMo only, solves web_search/web_fetch unavailability |

## Use Cases

- **MiMo / DeepSeek users**: Use Claude Code with search without switching models
- **Multi-model users**: One gateway to manage MiMo, DeepSeek, OpenAI and other providers
- **Text-only model users**: No need for a separate vision model — Fallback Vision handles it
- **Codex + Claude Code users**: One service for both protocols

## Development

```bash
npm test          # Run 62 tests
npm run dev       # Hot-reload development
npm run lint      # Type checking
```

## License

MIT
