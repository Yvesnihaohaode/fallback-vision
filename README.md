<h1 align="center">⚡ Fallback Vision</h1>

<p align="center">
  <strong>AI Gateway with Visual Fallback, Hybrid Search & Protocol Translation</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/fallback-vision"><img alt="npm" src="https://img.shields.io/npm/v/fallback-vision"></a>
  <a href="https://github.com/Yvesnihaohaode/fallback-vision/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/Yvesnihaohaode/fallback-vision"></a>
  <a href="https://github.com/Yvesnihaohaode/fallback-vision/actions"><img alt="tests" src="https://img.shields.io/badge/tests-62%20passed-brightgreen"></a>
  <a href="https://github.com/Yvesnihaohaode/fallback-vision"><img alt="stars" src="https://img.shields.io/github/stars/Yvesnihaohaode/fallback-vision?style=social"></a>
</p>

<p align="center">
  <strong>中文</strong> | <a href="docs/README_EN.md">English</a>
</p>

---

## 它是什么

Fallback Vision 是一个 **AI 网关**，坐在你的应用和 AI 模型之间，解决三个核心痛点：

1. **文字模型看不到图片** → 自动调用视觉模型分析图片，把描述传给主模型推理
2. **Claude Code / Codex 不兼容 MiMo 搜索** → 本地混合搜索引擎，4 个后端并行竞赛
3. **Anthropic 和 OpenAI 协议不互通** → 自动双向转换，一套网关两种协议都能用

```
你的应用 → Fallback Vision → 检测到图片？→ 视觉模型看图 → 主模型推理 → 回答
                         → 搜索请求？→ 4 后端竞赛 → 最快结果返回
                         → 协议不同？→ 自动转换 → 上游模型
```

## 核心特性

### 视觉回退路由
主模型没有多模态能力？没关系。Fallback Vision 自动检测图片，调用视觉模型生成结构化描述，再交给主模型推理。**主模型永远看不到原始图片，只看到分析结果。**

支持的主模型：MiMo、DeepSeek、OpenAI、Claude、Gemini、Qwen 等任意 OpenAI 兼容 API。

### 混合搜索引擎
MiMo 不支持 Claude Code 的 `web_search` / `web_fetch`？Fallback Vision 用 4 个搜索后端（**Bing / Sogou / Brave / Google**）并行竞赛，最快返回结果的获胜。

- **时效性过滤**：`day` / `week` / `month`，搜索"最新"信息不再过时
- **智能增强**：查询含"最新/latest"等关键词时自动启用时效过滤
- **代理友好**：兼容各种网络环境

### 协议转换
Claude Code 发 Anthropic 格式，Codex 发 OpenAI 格式——Fallback Vision 自动双向转换，流式 SSE 也完全支持。

### 一键启动
```bash
fv-claude   # 启动服务 + 配置 Claude Code + 打开 claude
fv-codex    # 启动服务 + 配置 Codex + 打开 codex
fv-stop     # 停止服务 + 恢复原始配置
```

## Quick Start

### npm（推荐）

```bash
npm install -g fallback-vision
fv-claude    # Claude Code 模式
fv-codex     # Codex 模式
```

### Docker

```bash
docker run -d -p 8789:8789 \
  -v ~/.fallback-vision:/root/.fallback-vision \
  yvesnihaohaode/fallback-vision:latest
```

### 源码

```bash
git clone https://github.com/Yvesnihaohaode/fallback-vision.git
cd fallback-vision
npm install
npm run build
node bin/fv-claude.js
```

所有方式都会自动打开 Web UI（http://127.0.0.1:8789）让你配置 API。

## 配置

浏览器打开 http://127.0.0.1:8789 进入 Web Dashboard：

| 配置项 | 说明 |
|--------|------|
| 客户端类型 | Codex (OpenAI) 或 Claude Code (Anthropic) |
| 主模型 | Provider + API Key + Base URL + 模型名 |
| 视觉模型 | Provider + API Key + Base URL + 模型名 |
| 本地搜索 | MiMo 专属，解决 web_search/web_fetch 不可用 |

## 架构

```
┌─────────────────────────────────────────────────────┐
│                  Fallback Vision                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Protocol  │→│  Router   │→│  Pipeline          │  │
│  │ Detector  │  │          │  │  ┌─────────────┐  │  │
│  │ Anthropic │  │ Vision?  │  │  │ Vision Model│  │  │
│  │ OpenAI    │  │ Search?  │  │  │ → describe  │  │  │
│  └──────────┘  └──────────┘  │  └──────┬──────┘  │  │
│                               │         ↓         │  │
│  ┌──────────┐                │  ┌─────────────┐  │  │
│  │  Search   │←──────────────│  │  Main Model │  │  │
│  │ 4 backends│                │  │  → reason   │  │  │
│  │ race      │                │  └─────────────┘  │  │
│  └──────────┘                └───────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Web Dashboard (http://127.0.0.1:8789)       │   │
│  │  Config · Logs · Metrics                     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

更详细的架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 一键命令

| 命令 | 用途 |
|------|------|
| `fv-claude` | 启动服务 + 打开 Claude Code |
| `fv-codex` | 启动服务 + 打开 Codex |
| `fv-claude-docker` | Docker 启动 + Claude Code |
| `fv-codex-docker` | Docker 启动 + Codex |
| `fv-stop` | 停止服务 + 恢复原始配置 |
| `fallback-vision-setup` | 交互式向导 |
| `fallback-vision` | 仅启动服务 |

## 适用场景

- **MiMo / DeepSeek 用户**：用 Claude Code 也能搜索，不用换模型
- **多模型用户**：一个网关统一管理 MiMo、DeepSeek、OpenAI 等多个 Provider
- **文字模型用户**：不需要单独的视觉模型，Fallback Vision 自动帮你调用
- **Codex + Claude Code 双修**：一套服务两种协议都能用

## 开发

```bash
npm test          # 运行 62 个测试
npm run dev       # 热重载开发
npm run lint      # 类型检查
```

## 文档

- [架构文档](docs/ARCHITECTURE.md)
- [路线图](docs/ROADMAP.md)
- [更新日志](CHANGELOG.md)
- [English README](docs/README_EN.md)

## License

MIT
