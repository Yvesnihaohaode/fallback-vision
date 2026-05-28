# AGENTS.md — Fallback Vision

## 项目定位

Fallback Vision 是全原创的 AI 视觉回退网关。
前身是 mimo-multi（mimo2codex fork），但本项目不依赖任何上游。

## 改代码前

1. 读 `docs/ARCHITECTURE.md` 了解系统结构
2. 读 `docs/ROADMAP.md` 了解待做事项
3. 确认改动不会破坏现有测试

## 改代码时

- 保持零框架依赖（只用 Node.js 内置模块）
- Provider 抽象层要可扩展（新 Provider 不应改核心代码）
- 图片检测逻辑要覆盖 Responses 和 Chat Completions 两种格式
- 所有新功能要有测试

## 改代码后

- 跑 `npm test` 确保所有测试通过
- 跑 `npx tsc --noEmit` 确保类型正确
- 更新相关文档

## 不要做的事

- 不要引入框架依赖（Express、Koa 等）
- 不要硬编码 Provider 信息（通过配置加载）
- 不要删除视觉回退逻辑（这是项目核心）
- 不要修改 mimo-multi 项目（由 Claude Code 管理）

## 相关项目

- mimo-multi：https://github.com/Yvesnihaohaode/mimo-multi（Claude Code 管理）
- mimo2codex：https://github.com/7as0nch/mimo2codex（上游）
