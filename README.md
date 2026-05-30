# ⚡ Fallback Vision

AI Gateway with intelligent visual fallback routing. When you send an image to a text-only model, it automatically routes to a vision model.

**当前版本: v0.5.4** | **状态: 核心功能完成，持续优化中**

```
Your App → Fallback Vision → Detects Image → Vision Model analyzes → Main Model reasons → Response
```

## 它能做什么

- **视觉回退**：主模型没多模态？自动调用视觉模型看图，把描述传给主模型推理
- **跨 Provider**：不管主模型是 MiMo、DeepSeek、OpenAI 还是 Claude，视觉回退都能工作
- **协议转换**：Claude Code (Anthropic) 和 Codex (OpenAI) 都能用
- **cc-switch 集成**：fv-claude 启动，fv-stop 恢复，无缝切换
- **MiMo 搜索适配**：Claude Code + MiMo 也能用 web_search / web_fetch

## Quick Start

### 方式一：npm（推荐）

```bash
npm install -g fallback-vision
fv-claude    # 启动 Claude Code 模式
fv-codex     # 启动 Codex 模式
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
| `fv-stop` | 停止服务 + 恢复原始配置 |
| `fallback-vision-setup` | 交互式向导 |
| `fallback-vision` | 仅启动服务 |

## 配置

浏览器打开 http://127.0.0.1:8789 进入 Web UI 配置：

1. **客户端类型** — Codex (OpenAI) 或 Claude Code (Anthropic)
2. **主模型** — Provider + API Key + Base URL + 模型名
3. **视觉模型** — Provider + API Key + Base URL + 模型名
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

## cc-switch 切换

```bash
fv-claude   # 启动 Fallback Vision，备份 cc-switch 配置
fv-stop     # 停止 FV，恢复 cc-switch 配置
```

## 开发

```bash
npm test          # 运行测试
npm run dev       # 热重载开发
npm run lint      # 类型检查
```

## 文档

- [架构文档](docs/ARCHITECTURE.md)
- [路线图](docs/ROADMAP.md)
- [更新日志](CHANGELOG.md)

## License

MIT
