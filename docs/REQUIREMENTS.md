# Fallback Vision — 项目需求文档

## 一、项目定位

Fallback Vision 是一个 AI 请求网关，核心解决一个问题：

> 用户往不支持图片的 AI 模型发了图片，请求会报错。
> Fallback Vision 自动检测图片，把请求转给能看图的模型。

## 二、核心功能

### 2.1 视觉回退（Visual Fallback）

- 拦截所有发往 AI 模型的请求
- 检测请求中是否包含图片
- 如果目标模型不支持图片 → 自动切换到支持图片的模型
- 切换策略：同 Provider 优先，跨 Provider 兜底

### 2.2 多 Provider 支持

通过环境变量配置，支持接入多个 AI 提供商：
- MiMo（小米）
- DeepSeek
- OpenAI
- 可扩展更多

### 2.3 Web 管理面板

提供一个 Web UI（Dashboard），用于：
- 查看已注册的 Provider 及其状态
- 查看每个模型的能力标签（Vision / Reasoning）
- 查看系统概览（Provider 数量、模型数量）

### 2.4 Docker 一键部署

- 提供 Dockerfile + docker-compose.yml
- 用户只需设置 API Key，一条命令启动

## 三、技术要求

| 项 | 要求 |
|---|---|
| 语言 | TypeScript |
| 运行时 | Node.js ≥ 20 |
| 框架依赖 | 零框架依赖（仅用 Node.js 内置模块） |
| 测试框架 | Vitest |
| 构建工具 | tsc（TypeScript 编译器） |
| 容器化 | Docker + Docker Compose |

## 四、支持的 API 格式

| 格式 | 用途 |
|---|---|
| OpenAI Chat Completions | `/v1/chat/completions` |
| OpenAI Responses | `/v1/responses` |

## 五、路由逻辑

```
请求进入
  ↓
解析 model 字段
  ↓
检测是否有图片
  ├─ 无图片 → 直接转发给目标 Provider
  └─ 有图片
       ↓
     目标模型支持 Vision？
       ├─ 是 → 直接转发
       └─ 否 → 查找 Vision 模型
              ├─ 同 Provider 有 Vision 模型 → 切换
              └─ 跨 Provider 有 Vision 模型 → 切换
                    ↓
                  转发请求，返回结果
```

## 六、Fallback 映射表

| 原始模型 | 回退到 |
|---|---|
| mimo-v2.5-pro | mimo-v2.5 |
| mimo-v2-pro | mimo-v2.5 |
| mimo-v2-flash | mimo-v2.5 |
| deepseek-v4-pro | mimo-v2.5（跨 Provider） |
| deepseek-v4-flash | mimo-v2.5（跨 Provider） |

## 七、目录结构

```
fallback-vision/
├── src/
│   ├── types.ts              # 核心类型
│   ├── cli.ts                # 命令行入口
│   ├── server.ts             # HTTP 服务器
│   ├── config/loader.ts      # 配置加载
│   ├── providers/
│   │   ├── base.ts           # Provider 基类
│   │   └── registry.ts       # Provider 注册中心
│   ├── routing/
│   │   ├── capability.ts     # 图片检测
│   │   └── router.ts         # 路由引擎
│   ├── proxy/upstream.ts     # 上游 HTTP 客户端
│   └── dashboard/            # Web UI
├── tests/                    # 测试
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 八、验收标准

- [x] 图片检测支持 Responses 和 Chat Completions 两种格式
- [x] 同 Provider 内视觉回退正常工作
- [x] 跨 Provider 视觉回退正常工作
- [x] 无图片时不影响原始请求
- [x] Web Dashboard 能正常显示 Provider 状态
- [x] Docker 能一键构建和启动
- [x] 所有测试通过（26 个）
- [x] TypeScript 编译零错误
