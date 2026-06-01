# Fallback Vision — 路线图

> 最后更新: 2026-06-01 (v0.6.0)

## ✅ 已完成

### 核心功能
- [x] 视觉回退核心（图片检测 + 自动切换模型）
- [x] 两步流程引擎（图片→视觉模型→描述→主模型→回答）
- [x] Capability Matrix（模型能力声明 + 动态查找）
- [x] 多 Provider 支持（MiMo / DeepSeek / OpenAI / Claude / Gemini / Qwen）
- [x] Provider 注册中心（动态注册、按模型查找、视觉模型发现）
- [x] 路由引擎（同 Provider 优先、跨 Provider 兜底）

### 协议支持
- [x] **OpenAI 协议**（Chat Completions + Responses API）— Codex 模式
- [x] **Anthropic Messages 协议** — Claude Code 模式
  - Anthropic ↔ OpenAI 双向转换
  - 流式 SSE 双向转换
  - 四个模型环境变量设置（ANTHROPIC_MODEL, HAIKU, SONNET, OPUS）
- [x] 自动检测客户端类型（Codex / Claude Code）

### 命令行
- [x] `fv-claude` — 启动服务 + 配置 Claude Code + 打开 claude
- [x] `fv-codex` — 启动服务 + 配置 Codex + 打开 codex
- [x] `fv-stop` — 停止服务 + 恢复原始配置（cc-switch 等）
- [x] `fv-claude-docker` / `fv-codex-docker` — Docker 版启动
- [x] `fallback-vision-setup` — 交互式向导
- [x] 保存并重启（Dashboard 点击后自动重启服务器）
- [x] 后台 detached 模式运行（关终端不影响服务）

### Web Dashboard
- [x] Web UI 配置界面 (http://127.0.0.1:8789)
- [x] 主模型配置（Provider + API Key + Base URL + 模型名）
- [x] 视觉模型配置（Provider + API Key + Base URL + 模型名）
- [x] 模型详情展示（能力、多模态支持等）
- [x] 二级目录分类（OpenAI / Anthropic / Google / MiMo / DeepSeek / Qwen / 其他）
- [x] 用户自定义 Base URL
- [x] 用户自定义模型名称
- [x] 保存并重启按钮
- [x] 请求指标追踪（总请求数、视觉回退率、平均延迟）
- [x] Ring Buffer 日志查看（最近 200 条）

### 搜索系统
- [x] 检测主模型是否为 MiMo 系列（基于 API 行为，非模型名称）
- [x] MiMo 模型时显示提示文字：「本程序已适配 MiMo 搜索」
- [x] 四后端混合搜索（Bing / Sogou / Brave / Google 并行竞赛）
- [x] 时效性过滤（`day` / `week` / `month`，各后端适配）
- [x] 智能查询增强（"最新/latest"关键词自动启用时效过滤）
- [x] 本地 web_search / web_fetch 处理
- [x] 非 MiMo 模型不显示、不拦截

### cc-switch 集成
- [x] fv-claude 启动时备份 cc-switch 配置
- [x] fv-stop 恢复 cc-switch 配置
- [x] 原始配置保存在 ~/.fallback-vision/original-claude-settings.json
- [x] 恢复优先级：原始配置 → 备份 → 从 FV 重建 → 清理 env

### 安装部署
- [x] npm 一键安装 (`npm install -g fallback-vision`)
- [x] Docker 一键部署
- [x] git clone 安装
- [x] 三种方式支持 Mac / Linux / Windows
- [x] Windows .cmd 脚本

### 测试
- [x] 8 个测试文件，62 个测试用例全部通过
- [x] Anthropic 协议转换测试
- [x] 图片检测测试
- [x] 路由测试
- [x] 搜索拦截测试
- [x] 流式传输测试
- [x] 设置持久化测试

## 🔜 待实现

### P1 — 应该做
- [ ] Web UI 美化（更好的视觉设计）
- [ ] Dashboard 实时状态刷新（WebSocket）
- [ ] 更多 Provider 预设（Gemini、Grok 等）

### P2 — 可以做
- [ ] Runtime Health（Provider 可用性探测、延迟监控、自动熔断）
- [ ] Routing Strategy（cost / latency / quality / balanced 策略）
- [ ] Provider Presets（已知厂商推荐配置模板）
- [ ] Dashboard 图表（Fallback 触发趋势、Provider 延迟图）
- [ ] 搜索结果缓存（减少重复请求）
