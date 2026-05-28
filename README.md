# ⚡ Fallback Vision

AI Gateway with intelligent visual fallback routing. When you send an image to a text-only model, it automatically routes to a vision model.

```
Your App → Fallback Vision → Detects Image → Vision Model analyzes → Main Model reasons → Response
```

## Quick Start

### Method 1: Docker (Easiest)

```bash
docker run -d -p 8789:8789 \
  -v ~/.fallback-vision:/root/.fallback-vision \
  fallback-vision:latest
```

Then open http://127.0.0.1:8789/ to configure your API keys.

### Method 2: One-Click Setup (Recommended)

```bash
git clone https://github.com/Yvesnihaohaode/fallback-vision.git
cd fallback-vision
npm install
npm run setup    # Interactive wizard — configures everything
npm run dev      # Start the server
```

The setup wizard asks for:
1. Client type (Codex / Claude Code)
2. Main model (Provider + API Key + Model name)
3. Vision model (Provider + API Key + Model name)
4. Local search toggle (MiMo only)

### Method 3: Manual Install

```bash
npm install -g fallback-vision
fallback-vision-setup    # Configure
fallback-vision          # Start
```

## Auto-Start Commands

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
source ~/path/to/fallback-vision/scripts/start.sh
```

Then use these commands:

| Command | Action |
|---|---|
| `fv-start` | Start Fallback Vision |
| `fv-claude` | Start + open Claude Code |
| `fv-codex` | Start + open Codex |
| `fv-stop` | Stop the server |
| `fv-status` | Check if running |

Example:

```bash
fv-claude    # Auto-starts proxy + launches Claude Code
```

## Configuration

Open http://127.0.0.1:8789/ in your browser to configure via Web UI.

Or edit `~/.fallback-vision/settings.json` directly.

### Client Type

| Client | Protocol | Proxy URL |
|---|---|---|
| Codex | OpenAI | `http://127.0.0.1:8789/v1/chat/completions` |
| Claude Code | Anthropic | `http://127.0.0.1:8789/v1/messages` |

### Claude Code Setup

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8789
claude
```

### Codex Setup

In `~/.codex/config.toml`:
```toml
[model_providers.fallback-vision]
base_url = "http://127.0.0.1:8789/v1"
```

## Features

- **Visual Fallback** — Images auto-route to vision model
- **Two-Step Pipeline** — Vision model analyzes, main model reasons
- **Multi-Protocol** — OpenAI + Anthropic support
- **Web UI** — Dashboard + Settings page
- **Local Search** — web_search/web_fetch for MiMo (DuckDuckGo/SearXNG)
- **Docker** — One-command deployment

## Visual Fallback Flow

No images → Main model directly

With images:
```
Step 1: Image → Vision Model → Structured description
Step 2: Question + Description → Main Model → Answer
```

## Local Search (MiMo Only)

MiMo doesn't support Claude Code's `web_search`/`web_fetch` tools. Enable "本地优化搜索" in Settings to have Fallback Vision handle search locally via SearXNG/DuckDuckGo.

## Development

```bash
npm test          # Run tests (59 tests)
npm run dev       # Start with hot reload
npm run lint      # Type check
```

## License

MIT
