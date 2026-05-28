# mimo-multi / AI Gateway / AI Infra 深度讨论记录

> 本文档整理自关于 mimo-multi、AI Gateway、模型编排、自动路由、Docker、AI Infra 的完整讨论记录。
> 
> 目标：
> - 给 Claude / Codex / ChatGPT 等继续分析
> - 保留当前世界观与架构思考
> - 记录 mimo-multi 的潜在进化路线

---

# 1. 项目背景：mimo-multi

项目：

- mimo-multi

作者：

- Yvesnihaohaode

本质：

- mimo2codex 的增强 fork

核心功能：

# Visual Fallback（视觉回退）

---

## 1.1 项目解决的问题

MiMo 某些模型：

- mimo-v2.5-pro
- mimo-v2-pro
- mimo-v2-flash

不支持图片输入。

用户发送图片时：

会报错：

```txt
404: No endpoints found that support image input
```

传统方案：

- 用户手动切模型
- 修改 config.toml
- 重启
- 重新请求

用户体验很差。

---

## 1.2 mimo-multi 的解决方案

自动：

```txt
检测图片
→ 判断当前模型是否支持视觉
→ 自动切换支持视觉的模型
→ 返回结果
```

例如：

```txt
mimo-v2.5-pro
→ 自动切换
→ mimo-v2.5
```

这就是：

# Capability Routing（能力路由）

---

# 2. 为什么这个项目有价值

这个项目不是：

- AI 套壳
- Chat 页面
- Prompt 拼接器

而是：

# AI 工程 / AI Infra 方向

核心价值：

- 解决真实问题
- 自动化错误恢复
- 提升 AI 使用体验
- 减少用户心智负担

本质：

# “请求调度”

而不是：

# “生成内容”

---

# 3. AI Gateway 是什么

AI Gateway：

# 所有 AI 模型的统一入口

架构：

```txt
你的应用
   ↓
AI Gateway
   ↓
GPT / Claude / Gemini / DeepSeek
```

应用不再直接调用模型。

而是：

# 调用 Gateway

---

## 3.1 AI Gateway 核心能力

### ① API 统一

不同厂商 API 不同：

OpenAI：

```json
{
  "messages":[]
}
```

Claude：

```json
{
  "prompt":""
}
```

Gemini：

```json
{
  "contents":[]
}
```

Gateway 会统一。

---

### ② 自动路由（Routing）

根据请求：

自动选模型。

例如：

```txt
图片请求
→ vision model
```

---

### ③ Failover（故障切换）

```txt
OpenAI 挂了
→ 自动切 Azure
```

---

### ④ Retry（自动重试）

模型失败：

```txt
retry
```

---

### ⑤ Cost Routing（成本路由）

简单请求：

```txt
cheap model
```

复杂请求：

```txt
reasoning model
```

---

### ⑥ Latency Routing（延迟路由）

谁快：

```txt
选谁
```

---

### ⑦ Provider Routing

一个模型：

可能多个 provider：

```txt
OpenAI 官方
Azure
第三方
```

Gateway 自动选择。

---

# 4. OpenRouter 是什么

OpenRouter：

# 公网 AI Gateway

类似：

# AI 模型淘宝

它聚合：

- OpenAI
- Claude
- Gemini
- DeepSeek
- Grok
- Llama

开发者只调用：

```txt
https://openrouter.ai/api
```

就能调所有模型。

---

## 4.1 OpenRouter 正在进化成什么

OpenRouter 已经不仅是：

# 模型聚合器

而是在变成：

# AI 请求操作系统（AI Request OS）

它已经开始：

- provider routing
- failover
- latency routing
- cost routing
- capability routing

未来可能继续：

- orchestration
- scheduling
- agent runtime
- runtime health
- observability

---

# 5. LiteLLM 是什么

LiteLLM：

# 开源版 OpenRouter

可以：

- 本地部署
- 自建 Gateway
- 统一 API
- fallback
- retry
- logging
- 路由

它非常像：

# AI Infra SDK

---

# 6. 模型编排（Model Orchestration）

未来 AI 不会是：

# 一个模型打天下

因为：

不同模型强项不同。

例如：

| 模型 | 强项 |
|---|---|
| Claude | 写代码 |
| Gemini | 多模态 |
| DeepSeek | 便宜 |
| GPT | 综合 |
| Grok | 联网 |

因此：

未来一定会：

# 多模型协作

---

## 6.1 编排例子

```txt
用户发图片
→ Gemini 看图
→ Claude 写代码
→ DeepSeek 总结
```

这就是：

# orchestration（编排）

---

# 7. 自动路由（Automatic Routing）

你当前项目已经实现了：

# 最小版 AI Routing

逻辑：

```python
if image:
    switch_model()
```

---

## 7.1 路由本质

路由：

# 决定请求去哪里

像网络路由器：

```txt
数据包去哪
```

AI 路由：

```txt
请求给哪个模型
```

---

## 7.2 为什么未来越来越重要

### 原因1：模型专业化

不同模型：

- 代码
- 数学
- 视觉
- 工具调用
- 推理

能力不同。

---

### 原因2：成本差异巨大

例如：

```txt
GPT-4
$10

DeepSeek
$0.1
```

企业一定会：

# 自动选择最便宜够用的

---

### 原因3：稳定性不同

有些 provider：

- 经常挂
- 限流
- 超时

所以：

# 必须自动切换

---

# 8. Capability Matrix（能力矩阵）

这是 AI Gateway 核心。

---

## 8.1 示例

```json
{
  "gpt-4o": {
    "vision": true,
    "tools": true,
    "reasoning": true
  },
  "deepseek-chat": {
    "vision": false,
    "tools": true
  }
}
```

---

## 8.2 用途

收到请求：

```json
{
  "image": true
}
```

系统：

```txt
筛选：
vision=true
```

然后：

```txt
自动选择模型
```

---

# 9. 自动能力探测

这是 mimo-multi 未来最重要方向之一。

---

## 9.1 当前问题

现在很多项目：

```python
if image:
   switch_model()
```

属于：

# hardcode（硬编码）

---

## 9.2 更高级方式

系统自动探测模型能力。

---

### 方法1：官方 metadata

例如：

```json
{
  "supports_vision": true
}
```

---

### 方法2：主动探测

系统自动：

```txt
发送测试图片
成功？
```

成功：

```txt
vision=true
```

失败：

```txt
vision=false
```

---

### 方法3：社区同步

同步：

- OpenRouter
- 官方模型列表
- 社区 metadata

---

# 10. Routing Strategy（路由策略）

能力筛选后：

还需要策略系统。

例如：

---

## 10.1 成本优先

```txt
cheap first
```

---

## 10.2 延迟优先

```txt
lowest latency
```

---

## 10.3 质量优先

```txt
best quality
```

---

## 10.4 混合策略

例如：

```txt
vision + cheap + fast
```

综合决策。

---

# 11. Runtime Health（运行时状态）

真正高级 Gateway：

不仅看静态能力。

还会看：

- provider health
- latency
- rate limit
- queue
- token budget
- region

这是：

# 动态调度

---

# 12. AI Request Lifecycle（AI 请求生命周期）

真正 Gateway 会管理：

```txt
request
→ classify
→ route
→ provider select
→ retry
→ fallback
→ normalize
→ logging
→ billing
→ response
```

你现在已经碰到了：

# request routing

阶段。

---

# 13. Provider Abstraction（Provider 抽象层）

这是 infra 核心能力之一。

目标：

# 统一不同模型 API

例如：

- OpenAI
- Claude
- Gemini
- DeepSeek

全部：

# 统一成同一种接口

---

# 14. AI Request OS（AI 请求操作系统）

讨论中提出：

未来 AI Gateway：

越来越像：

# Kubernetes

---

## 14.1 Kubernetes 是什么

K8s：

# 容器调度系统

负责：

```txt
哪个程序跑在哪台机器
```

---

## 14.2 AI Gateway 正在变成什么

AI Gateway：

# 模型调度系统

负责：

```txt
哪个请求给哪个模型
```

---

## 14.3 AI OS 未来可能管理

- 模型能力
- provider 健康
- 成本
- latency
- token
- queue
- orchestration
- tool routing
- agent runtime

---

# 15. Docker 是什么

Docker：

# 轻量虚拟化运行环境

---

## 15.1 Docker 解决的问题

传统部署：

```txt
我电脑能跑
别人电脑炸了
```

因为：

- node 版本
- npm
- python
- ffmpeg
- openssl

环境不同。

---

## 15.2 Docker 核心思想

# 把运行环境一起打包

---

# 16. Docker 核心概念

| 概念 | 类比 |
|---|---|
| Dockerfile | 菜谱 |
| Image（镜像） | 预制菜 |
| Container（容器） | 真正在吃的那份 |

---

# 17. Dockerfile 是什么

例如：

```dockerfile
FROM node:18

COPY . .

RUN npm install

CMD ["npm","start"]
```

意思：

```txt
基于 node18
复制代码
安装依赖
启动项目
```

---

# 18. 镜像（Image）

执行：

```bash
docker build
```

得到：

# Image（镜像）

里面包含：

- node
- npm
- 依赖
- Linux 环境
- 启动命令

---

# 19. 容器（Container）

执行：

```bash
docker run
```

镜像真正运行起来。

---

# 20. Docker Compose

真实项目：

不止一个服务。

例如：

| 服务 | 功能 |
|---|---|
| gateway | AI路由 |
| redis | 缓存 |
| postgres | 数据库 |
| web-ui | 前端 |
| worker | 后台任务 |

Compose：

# 一键启动全部服务

---

## 20.1 示例

```yaml
services:
  gateway:
    build: .

  redis:
    image: redis

  postgres:
    image: postgres
```

执行：

```bash
docker compose up
```

全部启动。

---

# 21. 为什么 Docker 对开源项目重要

因为：

大部分用户：

# 不会配环境

没有 Docker：

```txt
安装 node
安装 python
配置 ffmpeg
配置 CUDA
```

用户直接退出。

---

有 Docker：

```bash
docker compose up
```

就跑。

---

# 22. Web UI 是什么

不仅是网页。

更是：

# observability（可观测性）

---

## 22.1 Dashboard 可以展示

- 请求日志
- token 消耗
- fallback 次数
- provider 健康状态
- latency
- queue

这是 infra 核心能力之一。

---

# 23. 你当前项目真正的方向

mimo-multi：

已经不是：

# “聊天工具”

而是：

# AI Infra

方向。

已经涉及：

- capability routing
- request scheduling
- model orchestration
- provider abstraction

---

# 24. mimo-multi 的可能进化路线

```txt
mimo-multi
→ smart gateway
→ orchestration runtime
→ AI request OS
```

---

# 25. 建议的未来阶段

---

## 第一阶段

Capability Matrix：

```json
{
  "vision": true,
  "tools": false,
  "price": 0.2
}
```

自动维护。

---

## 第二阶段

Routing Strategy：

- cheap
- fast
- quality

策略系统。

---

## 第三阶段

Provider Abstraction：

统一：

- OpenAI
- Gemini
- Claude
- DeepSeek

接口。

---

## 第四阶段

Dashboard：

- token
- latency
- logs
- fallback
- health

---

## 第五阶段

Runtime Scheduling：

- 动态调度
- health aware
- latency aware
- cost aware

---

# 26. 最关键的认知转变

你已经开始从：

# “AI 使用者”

变成：

# “AI 系统设计者”

了。

这其实是：

- infra
- distributed systems
- scheduling
- runtime engineering

方向。

---

# 27. 最终总结

mimo-multi 当前虽然只是：

# visual fallback

但它背后已经隐含：

- AI Gateway
- Routing
- Scheduling
- Orchestration
- Runtime
- Provider Abstraction
- AI Request OS

这些 AI infra 核心概念。

继续往下做：

你会逐渐接近：

# 真正的 AI Infra / AI Runtime 系统
