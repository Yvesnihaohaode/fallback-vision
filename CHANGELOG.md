# Changelog

## v0.6.0 (2026-06-01)

### 混合搜索引擎
- **四后端混合搜索**: Bing / Sogou / Brave / Google 四个搜索后端并行竞赛，最快返回结果的获胜
- **时效性过滤**: 支持 `freshness` 参数（`day` / `week` / `month`），Google 用 `tbs=qdr:`，Bing 用 `filters=ex1`，Brave 用原生 API
- **智能查询增强**: 查询含"最新/latest"等关键词时自动启用时效性过滤
- **代理友好**: 搜索请求通过 `proxyFetch` 统一发出，兼容各种网络环境
- **MiMo 工具适配**: `web_search` 工具 schema 增加 `freshness` 可选字段

### Dashboard 可观测性
- **请求指标追踪**: 每次请求记录协议类型、模型、延迟、是否触发视觉回退
- **Dashboard 概览增强**: 显示总请求数、视觉回退触发率、平均延迟
- **Ring Buffer 日志**: 最近 200 条日志保留，Dashboard 实时查看

### GSAP CDN 回退
- **双 CDN 策略**: 主用 jsdelivr（国内更快），`onerror` 回退到 cdnjs
- **CSS 关键帧兜底**: GSAP 加载失败时 `.flow-node` 用 `nodeIn` 动画、`.card` / `.sb` 用 `fadeUp` 动画，确保 Data Flow 可视化始终可用

### 测试
- 搜索测试增加时效性过滤用例
- 全部 62 个测试通过

## v0.5.5 (2026-06-01)

### 文档 & 部署
- 全面更新所有文档（README、ARCHITECTURE、ROADMAP）
- 修复 Dockerfile 构建问题
- 创建 CHANGELOG

## v0.5.4 (2026-05-31)

### 核心修复
- **模型名称显示修复**: Claude Code 现在正确显示用户选择的主模型名称
  - 根因: Claude Code 读取 4 个环境变量（ANTHROPIC_MODEL, HAIKU, SONNET, OPUS）
  - 修复: fv-claude.js v2 同时设置所有 4 个变量
- **保存并重启**: Dashboard 点击 Save & Restart 后服务器自动重启，无需手动干预
- **后台运行**: 服务器以 detached 模式运行，关终端不会杀死服务

### cc-switch 集成
- fv-claude 启动时自动备份 cc-switch 配置到 ~/.fallback-vision/original-claude-settings.json
- fv-stop 自动恢复 cc-switch 配置，恢复优先级: 原始 → 备份 → 重建 → 清理
- 支持 fv-claude / fv-stop 无缝切换

### MiMo 搜索适配
- 检测主模型是否为 MiMo 系列（基于 API 行为检测，非模型名称匹配）
- MiMo 模型时显示提示:「因为 Claude Code 不兼容 MiMo 搜索，本程序已作出适配」
- 本地 web_search / web_fetch 处理（DuckDuckGo）
- 非 MiMo 模型不显示、不拦截

### Web Dashboard
- 模型二级目录分类（OpenAI / Anthropic / Google / MiMo / DeepSeek / Qwen / 其他）
- 用户自定义 Base URL 和模型名称
- 模型详情展示（能力、多模态支持等）

### 文档
- 全面更新 ROADMAP.md 反映真实进度
- 更新 ARCHITECTURE.md 包含 cc-switch 集成说明
- 创建 CHANGELOG.md

## v0.5.3 (2026-05-30)

### 功能
- 完成 Anthropic Messages ↔ OpenAI 双向转换
- 流式 SSE 双向转换
- Claude Code 模式支持

### 测试
- 新增 anthropic.test.ts
- 新增 streaming.test.ts

## v0.5.2 (2026-05-29)

### 功能
- 多 Provider 支持（MiMo / DeepSeek / OpenAI）
- Provider 注册中心
- 路由引擎（同 Provider 优先、跨 Provider 兜底）

### 测试
- 新增 registry.test.ts
- 新增 router.test.ts

## v0.5.1 (2026-05-28)

### 功能
- Capability Matrix（模型能力声明）
- 图片检测（支持 Responses 和 Chat Completions 格式）

### 测试
- 新增 capability.test.ts

## v0.5.0 (2026-05-28)

### 初始版本
- 视觉回退核心（两步流程引擎）
- OpenAI 格式代理
- Web Dashboard
- Docker 一键部署
- npm / Docker / git clone 三种安装方式
