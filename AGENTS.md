# AGENTS.md — Fallback Vision

## 项目定位

Fallback Vision 是全原创的 AI 视觉回退网关，当前版本 v0.5.4。
前身是 mimo-multi（mimo2codex fork），但本项目不依赖任何上游。

## 项目状态

**已完成的核心功能：**
- 视觉回退（图片→视觉模型→描述→主模型→回答）
- Anthropic Messages ↔ OpenAI 双向协议转换（让 Claude Code 能用任何模型）
- 多 Provider 支持（MiMo / DeepSeek / OpenAI / Claude / Gemini / Qwen）
- cc-switch 集成（fv-claude 启动，fv-stop 恢复）
- MiMo 搜索适配（本地 DuckDuckGo 处理 web_search / web_fetch）
- Web Dashboard 配置界面（http://127.0.0.1:8789）
- 三种安装方式（npm / Docker / git clone）支持 Mac / Linux / Windows

**关键文件：**
- `bin/fv-claude.js` — Claude Code 启动入口（v2，CommonJS）
- `bin/fv-codex.js` — Codex 启动入口
- `bin/fv-stop.js` — 停止服务 + 恢复 cc-switch 配置
- `src/server.ts` — 主服务器（Anthropic/OpenAI 协议自动检测）
- `src/proxy/pipeline.ts` — 两步流程引擎（核心）
- `src/dashboard/handler.ts` — Web UI API
- `src/tools/search.ts` — DuckDuckGo 搜索处理
- `src/translate/` — Anthropic ↔ OpenAI 双向转换

## 改代码前

1. 读 `docs/ARCHITECTURE.md` 了解系统结构
2. 读 `docs/ROADMAP.md` 了解待做事项
3. 读 `CHANGELOG.md` 了解最近改动
4. 确认改动不会破坏现有测试

## 改代码时

- 保持零框架依赖（只用 Node.js 内置模块）
- Provider 抽象层要可扩展（新 Provider 不应改核心代码）
- 图片检测逻辑要覆盖 Responses 和 Chat Completions 两种格式
- 所有新功能要有测试
- cc-switch 集成要保持（fv-claude / fv-stop 切换不能破坏）

## 改代码后

- 跑 `npm test` 确保所有测试通过
- 跑 `npx tsc --noEmit` 确保类型正确
- 更新相关文档（ROADMAP.md、CHANGELOG.md）
- 版本号在 package.json 中更新

## 不要做的事

- 不要引入框架依赖（Express、Koa 等）
- 不要硬编码 Provider 信息（通过配置加载）
- 不要删除视觉回退逻辑（这是项目核心）
- 不要修改 mimo-multi 项目（由 Claude Code 管理）
- 不要破坏 cc-switch 集成（fv-claude / fv-stop 切换）

## 相关项目

- mimo-multi：https://github.com/Yvesnihaohaode/mimo-multi（Claude Code 管理）
- cc-switch：https://github.com/farion1231/cc-switch（Tauri 桌面应用，85k+ stars）
- mimo2codex：https://github.com/7as0nch/mimo2codex（上游）

## ⚠️ 强制规则：Systematic Debugging

遇到任何 bug、测试失败、意外行为时，必须：
1. 第一句话说"我正在使用 systematic-debugging skill 进行排查"
2. 读取 ~/.codex/skills/systematic-debugging/SKILL.md 并严格遵守
3. 完成 Phase 1（根因调查）之前，禁止提出任何修复方案

## ⚠️ 强制规则：Verification Before Completion

即将声称"完成"、"修好"、"通过"，或准备 commit/PR 时，必须：
1. 第一句话说"我正在使用 verification-before-completion skill 进行验证"
2. 读取 ~/.codex/skills/verification-before-completion/SKILL.md 并严格遵守
3. 没跑验证命令、没看到输出之前，禁止声称任何任务已完成

## ⚠️ 强制规则：Writing Plans

收到新需求、新功能、多步骤任务时，必须在写代码之前：
1. 第一句话说"我正在使用 writing-plans skill 制定计划"
2. 读取 ~/.codex/skills/writing-plans/SKILL.md 并严格遵守
3. 用 update_plan 列出步骤，获得用户确认后再动手写代码
