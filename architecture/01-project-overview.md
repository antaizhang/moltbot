# Moltbot 项目架构总览

## 一句话介绍

Moltbot 是一个**多渠道 AI 聊天机器人网关**：它把 Telegram、Discord、Slack、Signal、WhatsApp、iMessage、Matrix、Teams 等 30+ 个聊天平台统一接入，通过一个中心网关把用户消息路由到 AI 大模型（Claude、GPT、Gemini 等），并将 AI 的回复送回对应的聊天平台。支持子Agent编排、交互式Canvas渲染、沙箱代码执行、语音通话、TTS语音合成等高级能力。

---

## 项目顶层目录结构

```
moltbot/
├── src/                          # 核心源码（TypeScript ESM，80+ 模块）
│   ├── agents/                   # AI Agent 引擎：模型调用、工具执行、流式响应
│   ├── auto-reply/               # 消息处理管线：入站处理 → AI 调用 → 回复生成
│   ├── gateway/                  # 网关服务器：WebSocket + HTTP + OpenAI 兼容 API
│   ├── channels/                 # 渠道抽象层：统一接口、权限、线程、提及
│   ├── routing/                  # 消息路由：决定消息由哪个 Agent/Session 处理
│   ├── config/                   # 配置系统：JSON5 配置文件 + Zod 校验
│   ├── plugins/                  # 插件系统：加载、注册、生命周期
│   ├── plugin-sdk/               # 插件 SDK：供扩展开发者使用的统一导出
│   ├── cli/                      # 命令行界面：Commander.js 命令注册
│   ├── commands/                 # CLI 命令实现
│   ├── infra/                    # 基础设施：用量统计、执行审批、设备配对
│   ├── media/                    # 媒体管线：下载、缓存、图片处理
│   ├── media-understanding/      # 媒体理解：图片/视频/音频内容分析
│   ├── image-generation/         # 图片生成：多提供商图片生成管线
│   ├── canvas-host/              # 交互式 Canvas UI（A2UI 渲染引擎）
│   ├── node-host/                # 沙箱执行环境：Docker / SSH / Local 后端
│   ├── context-engine/           # 上下文引擎：上下文组装与管理
│   ├── tts/                      # 语音合成（Text-to-Speech）
│   ├── memory/                   # 向量记忆：嵌入、索引、语义搜索
│   ├── browser/                  # 浏览器自动化：Playwright/CDP
│   ├── link-understanding/       # 链接理解：URL 内容提取与分析
│   ├── web-search/               # 网页搜索集成
│   ├── tui/                      # 终端用户界面（TUI）
│   ├── interactive/              # 交互式命令流程
│   ├── wizard/                   # 引导式配置向导
│   ├── pairing/                  # 设备配对协议
│   ├── secrets/                  # 密钥管理
│   ├── i18n/                     # 国际化支持
│   ├── markdown/                 # Markdown 处理与渲染
│   ├── line/                     # LINE 渠道相关
│   ├── logger.ts                 # 日志入口
│   ├── logging/                  # 日志系统
│   ├── compat/                   # 兼容性适配层
│   ├── telegram/                 # Telegram 渠道实现
│   ├── discord/                  # Discord 渠道实现
│   ├── slack/                    # Slack 渠道实现
│   ├── signal/                   # Signal 渠道实现
│   ├── imessage/                 # iMessage 渠道实现
│   ├── web/                      # Web/WhatsApp Web 渠道
│   ├── terminal/                 # 终端 UI：表格、调色板、进度条
│   ├── sessions/                 # 会话级配置覆盖
│   ├── security/                 # 安全策略
│   ├── hooks/                    # 用户自定义钩子
│   ├── cron/                     # 定时任务
│   ├── polls/                    # 投票功能
│   ├── process/                  # 进程管理
│   ├── daemon/                   # 守护进程
│   ├── bootstrap/                # 启动引导
│   ├── bindings/                 # 绑定层
│   ├── shared/                   # 共享工具代码
│   ├── extensions/               # 扩展加载运行时
│   ├── acp/                      # Agent Communication Protocol
│   ├── docs/                     # 内嵌文档资源
│   └── ...
├── extensions/                   # 插件扩展（独立 workspace 包，82 个）
│   ├── ── 渠道插件（~30 个）──
│   ├── telegram/                 # Telegram
│   ├── discord/                  # Discord
│   ├── slack/                    # Slack
│   ├── signal/                   # Signal
│   ├── imessage/                 # iMessage
│   ├── matrix/                   # Matrix 协议
│   ├── msteams/                  # Microsoft Teams
│   ├── googlechat/               # Google Chat
│   ├── whatsapp/                 # WhatsApp
│   ├── line/                     # LINE
│   ├── feishu/                   # 飞书
│   ├── irc/                      # IRC
│   ├── nostr/                    # Nostr 协议
│   ├── mattermost/               # Mattermost
│   ├── nextcloud-talk/           # Nextcloud Talk
│   ├── synology-chat/            # Synology Chat
│   ├── twitch/                   # Twitch
│   ├── tlon/                     # Tlon
│   ├── bluebubbles/              # BlueBubbles (iMessage 桥接)
│   ├── voice-call/               # 语音通话
│   ├── talk-voice/               # 语音对话
│   ├── zalo/                     # Zalo
│   ├── zalouser/                 # Zalo 用户端
│   ├── ── LLM 提供商插件（~20 个）──
│   ├── anthropic/                # Anthropic (Claude)
│   ├── openai/                   # OpenAI (GPT)
│   ├── google/                   # Google (Gemini)
│   ├── groq/                     # Groq
│   ├── mistral/                  # Mistral
│   ├── openrouter/               # OpenRouter
│   ├── ollama/                   # Ollama (本地模型)
│   ├── xai/                      # xAI (Grok)
│   ├── deepseek/                 # DeepSeek
│   ├── amazon-bedrock/           # AWS Bedrock
│   ├── anthropic-vertex/         # Anthropic via Vertex AI
│   ├── together/                 # Together AI
│   ├── nvidia/                   # NVIDIA
│   ├── huggingface/              # Hugging Face
│   ├── vllm/                     # vLLM
│   ├── sglang/                   # SGLang
│   ├── lobster/                  # Lobster (私有 LLM)
│   ├── qianfan/                  # 百度千帆
│   ├── minimax/                  # MiniMax
│   ├── moonshot/                 # 月之暗面 Moonshot
│   ├── volcengine/               # 火山引擎
│   ├── modelstudio/              # Model Studio
│   ├── ── 功能/工具插件（~15 个）──
│   ├── memory-core/              # 向量数据库记忆
│   ├── memory-lancedb/           # LanceDB 记忆后端
│   ├── device-pair/              # 设备配对
│   ├── diagnostics-otel/         # OpenTelemetry 诊断
│   ├── diffs/                    # 差异对比
│   ├── phone-control/            # 手机控制
│   ├── thread-ownership/         # 线程所有权
│   ├── llm-task/                 # LLM 任务调度
│   ├── exa/                      # Exa 搜索
│   ├── brave/                    # Brave 搜索
│   ├── tavily/                   # Tavily 搜索
│   ├── fal/                      # Fal.ai
│   ├── elevenlabs/               # ElevenLabs TTS
│   ├── deepgram/                 # Deepgram 语音
│   ├── perplexity/               # Perplexity 搜索
│   └── ...
├── skills/                       # Agent 内置技能（51 个）
│   ├── github/                   # GitHub 操作
│   ├── notion/                   # Notion 操作
│   ├── discord/                  # Discord 管理
│   ├── slack/                    # Slack 管理
│   ├── coding-agent/             # 编程助手
│   ├── canvas/                   # Canvas 交互
│   ├── obsidian/                 # Obsidian 笔记
│   ├── apple-notes/              # Apple Notes
│   ├── apple-reminders/          # Apple Reminders
│   ├── peekaboo/                 # 屏幕截图/摄像头
│   ├── healthcheck/              # 健康检查
│   ├── model-usage/              # 模型用量统计
│   ├── session-logs/             # 会话日志
│   └── ...
├── apps/                         # 平台原生应用
│   ├── ios/                      # iOS 应用（Swift）
│   ├── android/                  # Android 应用（Kotlin）
│   ├── macos/                    # macOS 菜单栏应用（SwiftUI）
│   └── shared/                   # 跨平台共享代码
├── packages/                     # NPM workspace 子包
│   ├── clawdbot/                 # ClawdBot 包
│   └── moltbot/                  # Moltbot 包
├── ui/                           # Web 控制面板（Vite + React）
├── docs/                         # 文档（Mintlify 托管）
├── scripts/                      # 构建和运维脚本
├── patches/                      # pnpm 补丁
└── vendor/                       # 第三方依赖
```

---

## 核心架构理念

### 1. 网关中心化
所有消息都经过**网关服务器**（Gateway Server）。网关负责：
- 启动和管理各渠道的连接
- 接收入站消息并路由到正确的 Agent
- 将 Agent 的回复发送回正确的渠道
- 提供 OpenAI 兼容的 HTTP API 端点

### 2. 渠道即插件
每个聊天平台（Telegram、Discord 等）都实现了统一的 `ChannelPlugin` 接口。核心渠道和扩展渠道使用相同的插件 API，区别只是核心渠道在 `src/` 里，扩展在 `extensions/` 里。目前支持 30+ 个渠道，涵盖主流 IM、社交平台、企业通信和开源协议。

### 3. Agent 引擎与渠道解耦
AI Agent 引擎不关心消息来自哪个平台。它只需要：
- 一段用户文本（可能附带图片、音频、视频、文件）
- 一组可用工具（包括技能、Canvas、沙箱执行等）
- 一个会话历史

Agent 生成回复后，由路由和渠道层负责投递。

### 4. 多模型支持
不绑定单一 AI 提供商。通过配置可以在 Anthropic（Claude）、OpenAI（GPT）、Google（Gemini）、AWS Bedrock、DeepSeek、Groq、Mistral、Ollama 等 20+ 个提供商之间切换，并支持自动降级和故障转移。

### 5. 子Agent编排
支持主Agent生成**子Agent**（Subagent）。子Agent拥有独立的会话上下文和工具集，可以专注处理特定子任务（如代码编写、搜索、数据分析等）。子Agent完成任务后，将结果汇报给主Agent，由主Agent汇总后回复用户。这种层级结构使得复杂任务可以被分解为多个并行或串行的子任务。

### 6. OpenAI 兼容 API
网关提供完整的 **OpenAI 兼容 HTTP API**，包括：
- `/v1/chat/completions` — 聊天补全（支持流式）
- `/v1/embeddings` — 文本嵌入
- `/v1/models` — 模型列表

这使得任何支持 OpenAI API 的客户端（如 Cursor、Continue、Open WebUI 等）都可以直接连接 Moltbot 网关，将其当作统一的 AI 代理层使用。

---

## 技术栈

| 层面 | 技术选型 |
|------|---------|
| 版本 | 2026.3.24（日期版本号） |
| 语言 | TypeScript (ESM) |
| 运行时 | Node.js 22+ / Bun |
| 包管理 | pnpm (workspace) |
| 构建 | tsc |
| Lint/Format | Oxlint + Oxfmt |
| 测试 | Vitest + V8 覆盖率 |
| CLI 框架 | Commander.js |
| 配置格式 | JSON5 + Zod 校验 |
| 网关通信 | WebSocket + HTTP (OpenAI 兼容) |
| TTS | edge-tts + 多提供商（ElevenLabs、Deepgram、sherpa-onnx 等） |
| Canvas | A2UI 交互式渲染引擎 |
| 沙箱执行 | Docker / SSH / Local 执行后端 |
| 移动端 | Swift (iOS/macOS) / Kotlin (Android) |
| 文档托管 | Mintlify |

---

## 关键数据流（一图看懂）

```
用户在 Telegram 发消息 "帮我搜一下天气"
         │
         ▼
┌─────────────────┐
│  Telegram Bot    │  ← 渠道层：接收 webhook/轮询
│  (bot-handlers)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  消息路由        │  ← 路由层：确定哪个 Agent、哪个 Session
│  (resolve-route) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent 引擎      │  ← 核心：构建 Prompt → 调用 LLM → 执行工具 → 流式响应
│  (pi-embedded-   │
│   runner)        │
└────────┬────────┘
         │
    ┌────┴─────────────────┐
    │                      │
    ▼                      ▼
┌──────────┐       ┌──────────────┐
│ LLM API  │       │ 子Agent 生成  │  ← 可选：主Agent 判断需要子Agent
│(Claude/  │       │ (subagent     │     完成特定子任务
│ GPT/     │       │  spawning)    │
│ Gemini)  │       └──────┬───────┘
└────┬─────┘              │
     │               ┌────┴────┐
     │               ▼         ▼
     │          ┌────────┐ ┌────────┐
     │          │子Agent │ │子Agent │  ← 独立会话 + 工具集
     │          │  A     │ │  B     │
     │          └───┬────┘ └───┬────┘
     │              │          │
     │              ▼          ▼
     │          ┌──────────────┐
     │          │ 结果汇总到    │
     │          │ 主Agent       │
     │          └──────┬───────┘
     │                 │
     ├─────────────────┘
     │
     ▼
┌─────────────────┐
│  回复投递        │  ← 出站层：格式化 + 分块 + 发送回 Telegram
│  (outbound)      │
└─────────────────┘
```

---

## 下一步阅读

- [02-module-details.md](./02-module-details.md) — 各模块详细说明
- [03-agent-llm-interaction.md](./03-agent-llm-interaction.md) — Agent 调度与大模型交互流程
- [04-detailed-design.md](./04-detailed-design.md) — 详细设计文档
- [05-stock-analysis-reuse-guide.md](./05-stock-analysis-reuse-guide.md) — 股票分析复用指南
- [06-local-model-deployment.md](./06-local-model-deployment.md) — 本地模型部署指南
