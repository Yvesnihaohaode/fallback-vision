# ⚡ Fallback Vision

AI Gateway with intelligent visual fallback routing. When you send an image to a text-only model, it automatically routes to a vision model.

```
Your App → Fallback Vision → Detects Image → Vision Model analyzes → Main Model reasons → Response
```

## Quick Start

### 方式一：npm（推荐）

```bash
npm install -g fallback-vision
fv-claude    # 启动 Claude Code
fv-codex     # 启动 Codex
```

### 方式二：Docker

```bash
docker run -d -p 8789:8789 \
  -v ~/.fallback-vision:/root/.fallback-vision \
  yvesnihaohaode/fallback-vision:latest
```

然后浏览器打开 http://127.0.0.1:8789 配置 API。

### 方式三：git clone

```bash
git clone https://github.com/Yvesnihaohaode/fallback-vision.git
cd fallback-vision
npm install
node bin/fv-claude.js    # 或 node bin/fv-codex.js
```

---

所有方式都会自动打开 Web UI 让你配置。

## 一键命令

| 命令 | 用途 |
|------|------|
| `fv-claude` | 启动服务 + 打开 Claude Code |
| `fv-codex` | 启动服务 + 打开 Codex |
| `fv-claude-docker` | Docker 启动 + Claude Code |
| `fv-codex-docker` | Docker 启动 + Codex |
| `fallback-vision-setup` | 交互式向导 |
| `fallback-vision` | 仅启动服务 |

## 配置

浏览器打开 http://127.0.0.1:8789 进入 Web UI 配置：

1. **客户端类型** — Codex (OpenAI) 或 Claude Code (Anthropic)
2. **主模型** — Provider + API Key + 模型名
3. **视觉模型** — Provider + API Key + 模型名
4. **本地搜索** — MiMo 专属，解决 web_search/web_fetch 不可用问题

### Claude Code

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:8789 claude
```

或直接运行 `fv-claude`。

### Codex

在 `~/.codex/config.toml` 中添加：

```toml
[model_providers.fallback-vision]
base_url = "http://127.0.0.1:8789/v1"
```

或直接运行 `fv-codex`。

## 视觉回退流程

**无图片** → 直接发给主模型

**有图片**：
1. 图片 → 视觉模型 → 结构化描述
2. 问题 + 描述 → 主模型 → 回答

主模型永远看不到原始图片，只看到视觉模型的分析结果。

## 本地搜索（MiMo 专属）

MiMo 不支持 Claude Code 的 `web_search` / `web_fetch`。

在设置页面开启「本地优化搜索」后，Fallback Vision 会用 DuckDuckGo 本地处理搜索请求。

## 开发

```bash
npm test          # 59 个测试
npm run dev       # 热重载开发
npm run lint      # 类型检查
```

## License

MIT
