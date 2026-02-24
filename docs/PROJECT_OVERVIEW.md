# OpenClaw 项目全景指南

> 本文档旨在帮助开发者快速深入理解 OpenClaw 项目的功能、架构和设计，为后续开发和定制提供参考。

---

## 1. 项目定位

**OpenClaw** 是一个**本地优先的个人 AI 助手平台**，核心理念是让用户在自己的设备上运行一个统一的 AI 网关（Gateway），通过它连接多个消息渠道（Telegram、WhatsApp、Discord、Slack 等），实现跨平台的智能对话和自动化。

- **目标用户**：希望拥有一个私有的、始终在线的、跨平台 AI 助手的个人用户和开发者
- **核心特性**：本地运行、多通道统一收件箱、多 Agent 路由、语音交互、插件扩展
- **仓库地址**：https://github.com/openclaw/openclaw
- **文档站**：https://docs.openclaw.ai

---

## 2. 技术栈

| 类别 | 技术选型 |
|------|---------|
| 语言 | TypeScript (ESM, 严格类型) |
| 运行时 | Node.js 22+（Bun 也支持开发/脚本） |
| 包管理 | pnpm（主）/ npm / Bun |
| CLI 框架 | Commander.js |
| Web 服务器 | Express 5 + WebSocket (ws) |
| 测试 | Vitest + V8 coverage（70% 阈值） |
| 代码质量 | Oxlint + Oxfmt |
| 构建工具 | tsdown (bundler) / tsx (execution) |
| AI Agent | pi-agent-core / pi-ai / pi-coding-agent |
| 消息集成 | grammy (Telegram), discord.js, @slack/bolt, baileys (WhatsApp), etc. |
| 媒体处理 | sharp (图像), pdfjs-dist, node-edge-tts |
| 浏览器自动化 | playwright-core |
| 向量存储 | sqlite-vec |
| 原生应用 | SwiftUI (macOS/iOS), Kotlin (Android) |

---

## 3. 项目目录结构

```
openclaw/
├── src/                    # 核心源码（详见下文）
├── extensions/             # 插件/扩展（workspace packages）
├── apps/                   # 原生客户端应用
│   ├── macos/              #   macOS 菜单栏应用 (SwiftUI)
│   ├── ios/                #   iOS 应用 (SwiftUI)
│   ├── android/            #   Android 应用 (Kotlin)
│   └── shared/             #   跨平台共享代码
├── docs/                   # Mintlify 文档站源码
├── dist/                   # 构建产物
├── scripts/                # 开发/发布/打包脚本
├── .github/                # CI/CD & PR/Issue 模板
├── package.json            # 项目配置 & 脚本
└── CLAUDE.md               # Agent/开发者指令文件
```

---

## 4. 核心架构

### 4.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          消息渠道层 (Channels)                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │Telegram│Discord│ │Slack │ │Signal│WhatsApp│iMessage│  ...更多  │  │
│  └───┬───┘└───┬──┘ └──┬───┘ └──┬──┘└───┬───┘└───┬───┘ └───┬────┘  │
│      │        │       │        │       │        │          │       │
│      └────────┴───────┴────┬───┴───────┴────────┴──────────┘       │
│                            │                                       │
│                    ┌───────▼────────┐                               │
│                    │  消息路由引擎   │  (src/routing/)               │
│                    │  Route Resolver │                               │
│                    └───────┬────────┘                               │
│                            │                                       │
│                    ┌───────▼────────┐                               │
│                    │  Gateway 网关   │  (src/gateway/)              │
│                    │  ┌───────────┐  │                              │
│                    │  │ Session   │  │  会话管理                     │
│                    │  │ Manager   │  │                              │
│                    │  ├───────────┤  │                              │
│                    │  │ Agent     │  │  Agent 调度                   │
│                    │  │ Runner    │  │                              │
│                    │  ├───────────┤  │                              │
│                    │  │ Plugin    │  │  插件系统                     │
│                    │  │ System    │  │                              │
│                    │  ├───────────┤  │                              │
│                    │  │ Cron      │  │  定时任务                     │
│                    │  │ Service   │  │                              │
│                    │  ├───────────┤  │                              │
│                    │  │ Auth &    │  │  认证与安全                   │
│                    │  │ Security  │  │                              │
│                    │  └───────────┘  │                              │
│                    └───────┬────────┘                               │
│                            │                                       │
│              ┌─────────────┼─────────────┐                         │
│              │             │             │                          │
│       ┌──────▼──┐   ┌──────▼──┐   ┌──────▼──┐                     │
│       │ AI Agent│   │ Memory  │   │ Tools   │                      │
│       │ (pi-ai) │   │ (向量)  │   │ (浏览器  │                     │
│       │         │   │         │   │  画布等) │                      │
│       └─────────┘   └─────────┘   └─────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 消息流转过程

```
用户在 Telegram 发送消息
  → Telegram monitor 接收 (src/telegram/bot-handlers.ts)
  → 渠道适配 → 标准化消息格式
  → 路由引擎根据 channel + account + peer 决定目标 Agent
  → Gateway 分发到对应 Agent 的 Session
  → AI Agent (pi-agent-core) 处理并生成回复
  → Gateway 通过渠道 send 方法回传
  → Telegram send 格式化并发送 (src/telegram/send.ts)
  → 用户收到回复
```

---

## 5. 核心模块详解

### 5.1 Gateway 网关 (`src/gateway/`)

Gateway 是整个系统的**中央控制面**，负责：

| 文件 | 职责 |
|------|------|
| `server.impl.ts` | 主服务器实现，组装所有子系统 |
| `server-http.ts` | HTTP/WebSocket 服务器启动 |
| `server-chat.ts` | 聊天消息处理与流式响应 |
| `server-channels.ts` | 渠道管理（启动/停止/状态） |
| `server-cron.ts` | 定时任务执行 |
| `server-startup.ts` | 初始化流程 |
| `server-methods/` | RPC 方法实现（WebSocket API） |
| `auth*.ts` | 认证与速率限制 |
| `config-reload.ts` | 配置热更新 |
| `node-registry.ts` | 节点（设备）注册管理 |
| `protocol/` | 通信协议定义 |

**关键设计**：
- Gateway 作为单进程运行，通过 WebSocket 与客户端（macOS app、Web UI、移动端）通信
- 支持热更新配置，无需重启即可生效
- 所有消息渠道的连接由 Gateway 统一管理

### 5.2 消息渠道系统 (`src/channels/` + 各渠道目录)

#### 渠道注册表 (`src/channels/registry.ts`)

核心渠道按优先级排列：

```typescript
CHAT_CHANNEL_ORDER = [
  "telegram",    // Bot API, 最简单入门
  "whatsapp",    // 通过 QR 码连接
  "discord",     // Bot API
  "irc",         // IRC 协议
  "googlechat",  // Google Chat
  "slack",       // Bolt API
  "signal",      // Signal 协议
  "imessage",    // iMessage (BlueBubbles)
]
```

#### 每个渠道的标准结构

所有渠道遵循统一的架构模式：

```
src/<channel>/
├── monitor.ts          # 入站消息监听与路由
├── send.ts             # 出站消息发送
├── accounts.ts         # 账号管理
├── format.ts           # 消息格式化与分块
├── bot.ts / client.ts  # 平台客户端封装
├── probe.ts            # 健康检查
└── *.test.ts           # 对应测试
```

#### 扩展渠道（Extensions）

通过插件系统支持更多渠道（`extensions/` 目录，共 38+ 扩展）：

| 扩展 | 说明 |
|------|------|
| `msteams` | Microsoft Teams |
| `matrix` | Matrix 协议 |
| `zalo` / `zalouser` | Zalo 越南社交平台 |
| `line` | LINE |
| `feishu` | 飞书 |
| `googlechat` | Google Chat |
| `mattermost` | Mattermost |
| `nostr` | Nostr 协议 |
| `irc` | IRC |
| `twitch` | Twitch |
| `nextcloud-talk` | Nextcloud Talk |
| `synology-chat` | 群晖 Chat |
| `tlon` | Tlon |
| `voice-call` | 语音通话 |
| `talk-voice` | 语音交互 |
| `bluebubbles` | BlueBubbles (iMessage) |
| ... | 更多见 extensions/ 目录 |

#### 渠道共享逻辑 (`src/channels/`)

```
src/channels/
├── registry.ts             # 渠道注册与元数据
├── dock.ts                 # 消息投递追踪
├── status-reactions.ts     # 状态指示器（处理中/完成等表情）
├── model-overrides.ts      # 按渠道选择不同 AI 模型
├── draft-stream-controls.ts # 流式输出控制
├── allowlists/             # 允许列表管理
└── plugins/                # 渠道插件类型定义
```

### 5.3 消息路由 (`src/routing/`)

路由引擎决定**哪条消息发送到哪个 Agent**：

```
src/routing/
├── resolve-route.ts   # 核心路由逻辑
├── session-key.ts     # Session Key 生成（channel + account + peer → key）
├── bindings.ts        # 渠道/账号绑定规则
├── account-id.ts      # 账号标识
└── account-lookup.ts  # 账号查找
```

**路由匹配优先级**（`matchedBy` 字段）：
1. `binding.peer` — 精确匹配对话者
2. `binding.peer.parent` — 匹配父线程
3. `binding.guild+roles` — Discord 服务器 + 角色
4. `binding.guild` — Discord 服务器
5. `binding.team` — Slack 团队
6. `binding.account` — 账号级别
7. `binding.channel` — 渠道级别
8. `default` — 默认 Agent

### 5.4 Agent 系统 (`src/agents/`)

```
src/agents/
├── agent.ts               # Agent 核心实现
├── agent-via-gateway.ts   # 通过 Gateway 远程调用 Agent
├── agents.ts              # Agent 集合管理
├── agents.config.ts       # Agent 配置
├── agents.identity.ts     # Agent 身份/人设
├── agent-scope.ts         # Agent 工作空间隔离
├── pi-embedded.ts         # 嵌入式 Pi Agent 运行器
├── model-selection.ts     # 模型选择逻辑
├── tools/                 # Agent 可用的工具集
├── skills/                # Agent 技能管理
├── subagent-registry.ts   # 子 Agent 注册
└── auth-choice*.ts        # 认证提供商选择（30+ 文件）
```

**关键概念**：
- **多 Agent**：支持创建多个 Agent，每个有独立身份、配置和工作空间
- **Session 隔离**：每个 Agent 维护独立的会话历史
- **工具系统**：Agent 可调用浏览器、画布、代码执行等工具
- **技能系统**：可动态加载/卸载技能包

### 5.5 插件系统 (`src/plugins/`)

```
src/plugins/
├── registry.ts    # 插件注册中心
├── loader.ts      # 插件加载器（动态 import）
├── discovery.ts   # 插件发现（本地 + npm）
├── hooks.ts       # 插件 Hook 执行
├── manifest*.ts   # 插件清单解析
├── install.ts     # 安装
├── uninstall.ts   # 卸载
├── update.ts      # 更新
├── tools.ts       # 工具暴露
├── services.ts    # 服务注册
└── types.ts       # 类型定义
```

**插件能力**：
- 注册新的消息渠道（Channel Plugin）
- 注册工具（Tool Plugin）
- 注册 CLI 命令
- 注册 HTTP 路由
- 注册 Hook（生命周期钩子）
- 注册服务
- 提供配置 UI

**插件 API 类型**（来自 `types.ts`）：

```typescript
OpenClawPluginApi
├── registerChannel()        // 注册消息渠道
├── registerTool()           // 注册 Agent 工具
├── registerCommand()        // 注册 CLI 命令
├── registerHttpHandler()    // 注册 HTTP 路由
├── registerHook()           // 注册生命周期钩子
├── registerService()        // 注册后台服务
└── registerProvider()       // 注册 AI 提供商
```

### 5.6 配置系统 (`src/config/`)

```
src/config/
├── io.ts            # 配置文件读写
├── schema.ts        # 主配置 Schema
├── zod-schema*.ts   # Zod 校验定义（20+ 文件）
├── defaults.ts      # 默认值
├── validation.ts    # 校验逻辑
├── sessions.ts      # Session 存储
├── paths.ts         # 配置文件路径
├── env-*.ts         # 环境变量处理
├── includes.ts      # 配置文件引用（include）
└── legacy*.ts       # 历史配置迁移
```

配置文件位于 `~/.openclaw/` 目录，使用 Zod 进行运行时校验。

### 5.7 Memory / 知识系统 (`src/memory/`)

为 Agent 提供**长期记忆和语义检索**能力：

```
src/memory/
├── manager.ts           # 内存管理器
├── search-manager.ts    # 语义搜索
├── embeddings*.ts       # 多嵌入模型支持
├── mmr.ts               # 最大边际相关性算法
├── query-expansion.ts   # 查询扩展
├── temporal-decay.ts    # 时间衰减评分
├── hybrid.ts            # 混合搜索策略
└── batch-*.ts           # 批量处理
```

支持的嵌入提供商：OpenAI、Voyage、Gemini 等。

### 5.8 基础设施 (`src/infra/`)

```
src/infra/
├── exec-*.ts          # 命令执行与安全审批（25+ 文件）
├── heartbeat-*.ts     # 心跳与定期任务（20+ 文件）
├── update-*.ts        # 自动更新检查（10+ 文件）
├── ports*.ts          # 端口管理
├── bonjour*.ts        # mDNS/Bonjour 设备发现
├── tailscale.ts       # Tailscale VPN 集成
├── ssh-*.ts           # SSH/SCP 工具
├── device-identity.ts # 设备认证
├── device-pairing.ts  # 设备配对
├── provider-usage*.ts # API 用量追踪
└── fetch.ts           # HTTP 请求封装
```

### 5.9 安全与审计 (`src/security/`)

```
src/security/
├── audit.ts            # 审计日志主逻辑
├── audit-extra*.ts     # 扩展审计
├── audit-channel.ts    # 渠道审计
├── skill-scanner.ts    # 技能安全扫描
├── safe-regex.ts       # 安全正则
├── external-content.ts # 外部内容验证
└── windows-acl.ts      # Windows 文件权限
```

### 5.10 CLI 层 (`src/cli/`)

```
src/cli/
├── program.ts         # CLI 程序构建器
├── run-main.ts        # CLI 执行入口
├── deps.ts            # 依赖注入
├── progress.ts        # 进度指示器
└── *-cli.ts           # 各子命令实现（90+ 文件）
    ├── gateway-cli/   #   gateway run/stop/status
    ├── channels-cli.ts#   channels add/remove/status
    ├── agents-cli.ts  #   agents add/delete/list
    ├── config-cli.ts  #   config get/set
    ├── plugins-cli.ts #   plugins install/uninstall
    ├── cron-cli/      #   cron add/remove/list
    ├── hooks-cli.ts   #   hooks management
    ├── memory-cli.ts  #   memory search/manage
    └── ...
```

### 5.11 其他模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 媒体处理 | `src/media/` | 图片处理、MIME 检测、Base64 |
| 浏览器控制 | `src/browser/` | Playwright 驱动的 Web 操作 |
| Canvas 画布 | `src/canvas-host/` | Agent 驱动的可视化工作区 |
| TTS 语音合成 | `src/tts/` | text-to-speech (ElevenLabs/edge-tts) |
| 定时任务 | `src/cron/` | Cron 表达式解析与调度 |
| 守护进程 | `src/daemon/` | launchd/systemd/schtasks 集成 |
| 终端 UI | `src/terminal/` | 表格、颜色主题、调色板 |
| 日志 | `src/logging/` | 结构化日志、脱敏、诊断 |
| 自动回复 | `src/auto-reply/` | 自动回复模板与调度 |
| Markdown | `src/markdown/` | Markdown 解析与转换 |
| 链接理解 | `src/link-understanding/` | URL 预览与元数据提取 |
| 配对 | `src/pairing/` | 设备认证与配对流程 |
| TUI | `src/tui/` | 终端交互式 UI |

---

## 6. 客户端应用

### macOS (`apps/macos/`)
- SwiftUI 菜单栏应用
- 功能：Gateway 管理、快速对话、语音唤醒
- 使用 Sparkle 框架自动更新

### iOS (`apps/ios/`)
- SwiftUI 原生应用
- 功能：远程节点接入、语音交互

### Android (`apps/android/`)
- Kotlin 原生应用
- 功能：远程节点接入

### Web UI
- Gateway 内置 Web 控制面板
- 功能：配置管理、聊天界面、渠道状态

---

## 7. 扩展开发指南

### 7.1 插件目录结构

```
extensions/my-plugin/
├── package.json      # 插件元数据 & 依赖
├── src/
│   └── index.ts      # 插件入口
└── tsconfig.json
```

### 7.2 插件入口模板

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export default function(api: OpenClawPluginApi) {
  // 注册渠道
  api.registerChannel({ ... });

  // 注册工具
  api.registerTool({
    name: "my-tool",
    description: "...",
    handler: async (ctx) => { ... }
  });

  // 注册 Hook
  api.registerHook("message:before", async (msg) => { ... });

  // 注册 CLI 命令
  api.registerCommand({ ... });
}
```

### 7.3 新增渠道的关键步骤

1. 在 `extensions/` 下创建新目录
2. 实现 `ChannelPlugin` 接口（monitor / send / accounts / probe）
3. 在 `package.json` 中声明依赖
4. 注册到插件系统
5. 更新 `.github/labeler.yml` 添加 label
6. 更新文档 `docs/channels/`

---

## 8. 开发命令速查

```bash
# 安装依赖
pnpm install

# 开发模式运行 CLI
pnpm openclaw <command>

# 启动 Gateway（开发模式，自动重载）
pnpm gateway:watch

# 启动 Web UI 开发服务器
pnpm ui:dev

# 类型检查
pnpm tsgo

# 代码检查 (lint + format)
pnpm check

# 格式化修复
pnpm format:fix

# 运行测试
pnpm test

# 带覆盖率的测试
pnpm test:coverage

# 构建
pnpm build

# 文档开发服务器
pnpm docs:dev
```

---

## 9. 关键设计模式

### 9.1 依赖注入

通过 `createDefaultDeps()` 创建依赖容器，CLI 和 Gateway 共享相同的依赖注入模式，便于测试和替换。

### 9.2 渠道抽象

所有渠道实现统一接口：`monitor`（入站）→ `send`（出站），中间通过标准化消息格式解耦。

### 9.3 会话隔离

每条对话通过 `sessionKey`（由 channel + account + peer 组合生成）唯一标识，支持按 Agent/按渠道/按对话者的会话隔离。

### 9.4 热更新配置

Gateway 通过 `config-reload.ts` 监听配置文件变化，支持运行时无重启更新渠道、Agent、插件配置。

### 9.5 插件即扩展

核心渠道（Telegram/Discord/Slack 等）和扩展渠道使用相同的插件 API，保持架构一致性。

### 9.6 审计与安全

所有命令执行经过审批系统，支持审计日志、正则安全检查、外部内容验证。

---

## 10. 数据流向总结

```
配置文件 (~/.openclaw/)
    ↓
Gateway 启动 → 加载配置 → 初始化插件 → 启动渠道连接
    ↓
渠道 Monitor 监听消息
    ↓
消息标准化 → 路由解析 → Agent 匹配
    ↓
Agent 执行（调用 AI 模型 + 工具）
    ↓
生成回复 → 渠道 Send 发送
    ↓
Session 持久化 + 审计日志
```

---

## 11. 版本与发布

- **版本格式**：`YYYY.M.D`（如 `2026.2.23`）
- **发布渠道**：
  - `stable`：正式标签发布，npm dist-tag `latest`
  - `beta`：预发布 `vYYYY.M.D-beta.N`，npm dist-tag `beta`
  - `dev`：main 分支最新代码
- **平台发布**：npm (CLI) + macOS app (Sparkle) + iOS/Android (App Store/Play Store)
