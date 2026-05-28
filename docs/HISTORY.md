# Fallback Vision — 项目历史与演进

## 起源

### mimo2codex（上游项目）
- 作者：7as0nch
- 仓库：https://github.com/7as0nch/mimo2codex
- 功能：让 Codex 桌面端能用 MiMo 模型
- 协议：OpenAI 兼容（/v1/responses、/v1/chat/completions）

### mimo-multi（第一次进化）
- 作者：Yvesnihaohaode（本项目作者）
- 仓库：https://github.com/Yvesnihaohaode/mimo-multi
- 本质：mimo2codex 的增强 fork
- 核心改动：在 `src/server.ts` 两处插入视觉回退逻辑
- npm 包：`npm install -g mimo-multi`
- 状态：已发布，由 Claude Code 管理

### Fallback Vision（第二次进化 — 全原创）
- 不再依赖 mimo2codex
- 从零设计架构
- 目标：成为通用 AI 视觉回退网关

---

## 视觉回退的核心问题

MiMo 某些模型（mimo-v2.5-pro、mimo-v2-pro、mimo-v2-flash）不支持图片输入。
用户发图片时会报错：`404: No endpoints found that support image input`

传统方案：用户手动切模型 → 改 config.toml → 重启 → 重新请求（体验很差）

Fallback Vision 方案：自动检测图片 → 自动切换到视觉模型 → 用户无感

---

## 技术演进路线（五阶段）

### 第一阶段：Capability Matrix ✅
- 每个模型声明 `supportsImages` 能力
- 请求时动态查找视觉模型
- 同 Provider 优先，跨 Provider 兜底

### 第二阶段：Routing Strategy ❌
- 根据请求特征选择最优模型
- 策略：cost（成本优先）/ latency（延迟优先）/ quality（质量优先）/ balanced（均衡）
- 需要模型定价数据和延迟统计

### 第三阶段：Provider Abstraction 🔶
- 统一不同 AI 提供商的接口
- 当前支持：OpenAI 格式（Chat Completions + Responses）
- 待支持：Anthropic Messages 格式（Claude Code 用）
- 核心工作：双向格式转换 + 流式 SSE 转换

### 第四阶段：Dashboard ✅（基础版）
- Web UI 显示 Provider 状态、模型能力
- 待增强：请求日志、Token 统计、Fallback 次数

### 第五阶段：Runtime Scheduling ❌
- Provider 健康检测
- 动态调度：根据实时延迟、错误率选择 Provider
- 需要健康检查机制和熔断器

---

## Claude Code 视觉回退方案（待实现）

### 当前状态：外挂 Qwen
Claude Code 用 DeepSeek 时遇到图片，靠 PostToolUse hook 让 Qwen3.5-Plus 描述图片，返回文字给 DeepSeek。
信息有损，不是真正的视觉回退。

### 为什么 Codex 方案不能直接用于 Claude Code

| | Codex | Claude Code |
|---|---|---|
| 协议 | OpenAI 兼容 | Anthropic Messages |
| 代理 | mimo-multi 在中间拦截 | 直连 api.deepseek.com/anthropic |
| 改路由 | 改 model 字段就行 | hook 只能注入文字，改不了路由 |

### 要做的事
1. 解析 Anthropic Messages 请求（`type: "image"` 检测图片）
2. 格式转换：Anthropic Messages → OpenAI Chat Completions
3. 反向转换：OpenAI Chat → Anthropic Messages
4. 流式 SSE 转换

---

## mimo-multi 的视觉回退覆盖表

| 非视觉模型 | 自动切换到 |
|---|---|
| mimo-v2.5-pro | mimo-v2.5 |
| mimo-v2-pro | mimo-v2.5 |
| mimo-v2-flash | mimo-v2.5 |
| deepseek-v4-pro | mimo-v2.5（跨 provider） |
| deepseek-v4-flash | mimo-v2.5（跨 provider） |

---

## AI Infra 方向认知

这个项目不是 AI 套壳、Chat 页面、Prompt 拼接器。
本质是 **AI 请求调度**，属于 AI Infra / AI Gateway 方向。

核心价值：
- 解决真实问题（图片报错）
- 自动化错误恢复
- 提升 AI 使用体验
- 减少用户心智负担

未来方向：AI Request OS — 像 Kubernetes 管理容器一样管理 AI 请求。
