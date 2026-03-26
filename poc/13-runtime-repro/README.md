# OpenClaw 安装版复现指南（Hook + Skill）

这个目录提供最小可运行模板，用于把 `poc/13-sensitive-data-guardrails.ts` 的思路接到你本机已安装的 OpenClaw。

## 0) 前提

- Gateway 已运行（Dashboard Health OK）
- 本机有 `openclaw` CLI

## 1) 安装本地 Hook/Skill 到 workspace

```bash
# 1) 找到当前 workspace（通常是 ~/.openclaw/workspace）
openclaw config get agents.defaults.workspace

# 2) 准备目录
mkdir -p ~/.openclaw/workspace/hooks/data-guardrail
mkdir -p ~/.openclaw/workspace/skills/data-guardrail

# 3) 复制模板
cp poc/13-runtime-repro/hook/HOOK.md ~/.openclaw/workspace/hooks/data-guardrail/
cp poc/13-runtime-repro/hook/handler.ts ~/.openclaw/workspace/hooks/data-guardrail/
cp poc/13-runtime-repro/skill/SKILL.md ~/.openclaw/workspace/skills/data-guardrail/
```

## 2) 开启配置

编辑 `~/.openclaw/openclaw.json`，确保有：

```json5
{
  hooks: {
    internal: {
      enabled: true,
      entries: {
        "data-guardrail": { enabled: true },
      },
    },
  },
  skills: {
    entries: {
      "data-guardrail": { enabled: true },
    },
  },
}
```

## 3) 用 CLI 检查是否生效

```bash
openclaw hooks list --verbose
openclaw hooks info data-guardrail
openclaw skills list
```

## 4) 发送一条包含敏感信息的测试消息

测试文本示例：

```text
手机号 13800138000，邮箱 alice.test@example.com，身份证 110105199003071234，key sk-1234567890abcdef12345678
```

预期：

- Hook 将 `event.context.content` 改成脱敏文本
- `event.context.guardrail` 包含命中计数和类型
- `event.messages` 增加 guardrail 摘要

## 5) 在 Dashboard 验证

- **Logs**：确认只出现摘要信息，不出现明文
- **Sessions**：确认会话文本是脱敏后内容

## 6) 问题排查

```bash
openclaw hooks check
openclaw logs --follow
```

若 `data-guardrail` 未出现，优先检查：

- 文件是否在 `<workspace>/hooks/data-guardrail/` 下
- `HOOK.md` frontmatter 是否可解析
- `hooks.internal.enabled` 和 `entries.data-guardrail.enabled` 是否为 true
