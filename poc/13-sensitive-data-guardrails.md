# POC 13: 敏感数据识别检测 + 数据重写（可验证方案）

> 目标：回答 3 个问题并可验证：
>
> 1. Moltbot/OpenClaw 哪些位置可能发生个人敏感数据泄露？
> 2. 如果加入“敏感数据识别 + 重写”，从输入到处理中间节点应该怎么走？
> 3. Skill 要怎么配置，最终数据处理结果是什么？

---

## 1) 可能的敏感数据泄露面（按数据流分层）

### A. 输入层（Channel → Hook Event）

消息事件上下文会携带 `from`、`content`、`channelId`、`conversationId` 等字段。这里如果不做预处理，原始手机号/邮箱/证件号会直接进入后续链路。参考事件定义：`message:received`、`message:preprocessed`、`message:transcribed`。  
来源：`src/hooks/internal-hooks.ts`

### B. 会话持久化层（Session Transcript）

会话转录会把消息落盘 JSONL（追加写入）。如果未脱敏，敏感字段会以明文进入会话文件。  
来源：`src/config/sessions/transcript.ts`、`poc/09-session-persistence.ts`

### C. 日志层（Console/File）

日志文档明确写了：`logging.redactSensitive` 仅影响控制台输出，不会改写文件日志本体；因此如果上游未重写，文件日志仍可能保留敏感明文。  
来源：`docs/logging.md`

### D. Skill 环境注入层（技能配置）

`skills.entries.*.env/apiKey` 会在 agent run 时注入 host 进程环境，若误把用户输入/敏感数据放进 env，可能扩大暴露面。  
来源：`docs/tools/skills.md`、`docs/tools/skills-config.md`、`src/agents/skills/env-overrides.ts`

---

## 2) 建议的数据处理链路（输入 → 中间节点 → 输出）

建议把“识别 + 重写”放在**最靠前**的位置（消息进入后、工具调用前）：

1. **Input Normalize**：统一空白字符/编码。
2. **Sensitive Detect**：按类型扫描（手机号、邮箱、证件号、API key…）。
3. **Policy Evaluate**：判断风险级别（是否阻断、是否仅重写）。
4. **Rewrite/Mask**：把明文替换为掩码。
5. **Downstream Fanout**：
   - 发给工具（`web_search`/`memory_search`）的是脱敏文本
   - 写入 session 的是脱敏文本
   - 日志打点只记录 hit 计数与类型，不落敏感值
6. **Audit Artifact**：落一个可回放工件（JSON）用于验收。

在本 POC 里，对应脚本为：`poc/13-sensitive-data-guardrails.ts`。

---

## 3) Skill 该怎么配（落地建议）

下面是一个可落地的最小配置思路（两层）：

### 3.1 Skill frontmatter（示意）

```yaml
---
name: data-guardrail
description: Detect and rewrite sensitive data before tool/session/log fanout
metadata:
  {
    "openclaw":
      {
        "requires": { "config": ["hooks.internal.enabled"] },
        "primaryEnv": "DATA_GUARDRAIL_API_KEY",
      },
  }
---
```

### 3.2 `~/.openclaw/openclaw.json`（示意）

```json5
{
  hooks: { internal: { enabled: true } },
  skills: {
    entries: {
      "data-guardrail": {
        enabled: true,
        config: {
          detectTypes: ["phone", "email", "id-cn", "api-key"],
          rewriteEnabled: true,
          blockWhenHighRisk: false,
          auditEnabled: true,
        },
      },
    },
  },
}
```

说明：

- `blockWhenHighRisk=false` 代表“不中断业务，只做重写”。
- 若要更严格，设为 `true`，遇到高风险直接阻断并返回“请移除敏感信息后重试”。

---

## 4) 本 POC 的可验证结果

### 4.1 执行命令

```bash
bun poc/13-sensitive-data-guardrails.ts
```

### 4.2 验证点

脚本会自动做三类校验：

1. **重写结果不含明文敏感值**。
2. **Tool Payload 不含明文敏感值**。
3. **Session Entry 不含明文敏感值**。

并生成工件：

- `poc/.sensitive-guardrail-artifacts/latest.json`
- `poc/.sensitive-guardrail-artifacts/run-<timestamp>.json`

你可以直接 `cat` 工件验证最终文本确实是脱敏后的版本。

---

## 5) 处理后的结果长什么样（示例）

输入（示例，含敏感数据）：

- 手机号：`13800138000`
- 邮箱：`alice.test@example.com`
- 身份证：`110105199003071234`
- API key：`sk-1234567890abcdef12345678`

输出（脱敏后）：

- 手机号：`138****8000`
- 邮箱：`al***@example.com`
- 身份证：`110105********1234`
- API key：`sk-123********5678`

中间节点（工具入参、会话记录、日志摘要）都只看到脱敏数据或统计信息，不再看到明文。

---

## 6) 和现有 POC 的关系

- `poc/07-hooks-event-driven.ts`：展示了 Hook 驱动入口；本方案建议在这里前插 Guardrail。
- `poc/09-session-persistence.ts`：展示了 JSONL 持久化；本方案确保写入前先重写。
- `poc/00-full-pipeline.ts`：展示了全链路；本方案是全链路前置防护层。
