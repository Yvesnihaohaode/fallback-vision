# Fallback Vision — 路线图

## 已完成

- [x] 视觉回退核心（图片检测 + 自动切换模型）
- [x] Capability Matrix（模型能力声明 + 动态查找）
- [x] 多 Provider 支持（MiMo / DeepSeek / OpenAI）
- [x] Provider 注册中心（动态注册、按模型查找、视觉模型发现）
- [x] 路由引擎（同 Provider 优先、跨 Provider 兜底）
- [x] OpenAI 格式代理（Chat Completions + Responses API）
- [x] Web Dashboard（Provider 状态、模型能力）
- [x] Docker 一键部署
- [x] 测试覆盖（26 个测试）

## 待实现

### P0 — 必须做

- [ ] **Anthropic Messages 协议支持**
  - 解析 `/v1/messages` 请求
  - Anthropic Messages → OpenAI Chat Completions 转换
  - OpenAI Chat Completions → Anthropic Messages 转换
  - 流式 SSE 双向转换
  - 让 Claude Code 能用 Fallback Vision

### P1 — 应该做

- [ ] **Routing Strategy（路由策略）**
  - cost 策略：优先选便宜的模型
  - latency 策略：优先选快的模型
  - quality 策略：优先选质量高的模型
  - balanced 策略：综合考虑

- [ ] **请求日志与统计**
  - 记录每次请求的 Provider、模型、是否触发 Fallback
  - Token 消耗统计
  - 延迟统计
  - Dashboard 展示

### P2 — 可以做

- [ ] **Runtime Health（运行时健康检测）**
  - Provider 可用性探测
  - 延迟监控
  - 错误率统计
  - 自动熔断（连续失败后暂时下线）

- [ ] **更多 Provider**
  - Gemini
  - Grok
  - 通用 OpenAI 兼容 Provider（用户自定义）

- [ ] **Provider Presets（预设配置）**
  - 已知厂商的推荐配置模板
  - 友好错误信息翻译

- [ ] **Web UI 增强**
  - 请求日志列表
  - Fallback 触发次数图表
  - Provider 延迟图表
  - 实时状态刷新
