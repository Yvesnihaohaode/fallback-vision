# Fallback Vision — 架构文档

## 核心理念

用户设置两个模型：
- **主模型**：处理所有文字/代码任务
- **视觉模型**：只在需要识别图片时被调用

不管主模型有没有多模态能力，遇图永远走视觉模型。

## 两步流程（核心）

当检测到图片时：

```
Step 1: 图片 → 视觉模型 → 结构化图片描述
Step 2: 原始问题 + 图片描述 → 主模型 → 完整回答
```

视觉模型当"眼睛"，主模型当"大脑"。

### Step 1: Vision Model（眼睛）

视觉模型分析图片，输出结构化描述：
- 物体、人物、文字、布局
- 关键细节和上下文
- 图片中可见的文字/数字

### Step 2: Main Model（大脑）

主模型收到：
- 原始用户问题
- 视觉模型的详细图片描述
- 指令："基于图片分析回答问题，不要提到你收到了描述"

主模型基于图片内容进行推理、编码、分析。

## 无图片时

直接 → 主模型（单步，无视觉参与）

## 目录结构

```
src/
├── types.ts              # 核心类型
├── cli.ts                # 命令行入口
├── server.ts             # HTTP 服务器
├── config/
│   ├── loader.ts         # 配置加载（从 settings.json）
│   └── settings.ts       # 设置持久化 + 模型能力数据库
├── providers/
│   ├── base.ts           # Provider 基类
│   └── registry.ts       # Provider 注册中心
├── routing/
│   ├── capability.ts     # 图片检测
│   └── router.ts         # 路由决策
├── proxy/
│   ├── upstream.ts       # 上游 HTTP 客户端
│   └── pipeline.ts       # ⭐ 两步流程引擎（核心）
└── dashboard/            # Web UI
```

## 环境变量

| 变量 | 说明 |
|---|---|
| FALLBACK_VISION_PORT | 监听端口（默认 8789） |
| FALLBACK_VISION_HOST | 监听地址（默认 127.0.0.1） |
| FALLBACK_VISION_VERBOSE | 调试日志 |

API Key 和模型配置通过 Dashboard Settings 页面管理，存储在 `~/.fallback-vision/settings.json`。
