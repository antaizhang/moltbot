/**
 * POC 13: 敏感数据识别 + 重写（Data Guardrails）
 *
 * 演示: 输入消息 → 识别敏感数据 → 重写脱敏 → 进入中间处理节点 → 落盘审计
 * 运行: bun poc/13-sensitive-data-guardrails.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type RiskLevel = "low" | "medium" | "high";

type SensitiveType = "phone" | "email" | "id-cn" | "api-key";

type SensitiveHit = {
  type: SensitiveType;
  risk: RiskLevel;
  match: string;
  replacement: string;
  start: number;
  end: number;
};

type GuardrailSkillConfig = {
  skillName: "data-guardrail";
  enabled: boolean;
  detectTypes: SensitiveType[];
  rewriteEnabled: boolean;
  blockWhenHighRisk: boolean;
  audit: {
    enabled: boolean;
    artifactDir: string;
  };
};

type PipelineState = {
  input: string;
  normalized: string;
  hits: SensitiveHit[];
  rewritten: string;
  toolPayload: string;
  sessionEntry: string;
  logLine: string;
  blocked: boolean;
};

const ARTIFACT_DIR = join(import.meta.dirname, ".sensitive-guardrail-artifacts");

const guardrailSkillConfig: GuardrailSkillConfig = {
  skillName: "data-guardrail",
  enabled: true,
  detectTypes: ["phone", "email", "id-cn", "api-key"],
  rewriteEnabled: true,
  blockWhenHighRisk: false,
  audit: {
    enabled: true,
    artifactDir: ARTIFACT_DIR,
  },
};

const DETECTORS: Array<{
  type: SensitiveType;
  risk: RiskLevel;
  regex: RegExp;
  replace: (raw: string) => string;
}> = [
  {
    type: "phone",
    risk: "medium",
    regex: /(?<!\d)(1[3-9]\d{9})(?!\d)/g,
    replace: (raw) => `${raw.slice(0, 3)}****${raw.slice(-4)}`,
  },
  {
    type: "email",
    risk: "medium",
    regex: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    replace: (raw) => {
      const [name, domain] = raw.split("@");
      if (!name || !domain) {
        return "[EMAIL_REDACTED]";
      }
      return `${name.slice(0, 2)}***@${domain}`;
    },
  },
  {
    type: "id-cn",
    risk: "high",
    regex: /\b\d{17}[\dXx]\b/g,
    replace: (raw) => `${raw.slice(0, 6)}********${raw.slice(-4)}`,
  },
  {
    type: "api-key",
    risk: "high",
    regex: /\bsk-[A-Za-z0-9]{16,}\b/g,
    replace: (raw) => `${raw.slice(0, 6)}********${raw.slice(-4)}`,
  },
];

function detectSensitive(text: string, enabledTypes: SensitiveType[]): SensitiveHit[] {
  const hits: SensitiveHit[] = [];

  for (const detector of DETECTORS) {
    if (!enabledTypes.includes(detector.type)) {
      continue;
    }
    for (const match of text.matchAll(detector.regex)) {
      const raw = match[0];
      const start = match.index ?? -1;
      hits.push({
        type: detector.type,
        risk: detector.risk,
        match: raw,
        replacement: detector.replace(raw),
        start,
        end: start + raw.length,
      });
    }
  }

  return hits.toSorted((a, b) => a.start - b.start);
}

function rewriteSensitive(text: string, hits: SensitiveHit[]): string {
  let rewritten = text;
  for (const hit of hits) {
    rewritten = rewritten.split(hit.match).join(hit.replacement);
  }
  return rewritten;
}

function processPipeline(input: string, config: GuardrailSkillConfig): PipelineState {
  const normalized = input.trim().replace(/\s+/g, " ");
  const hits = config.enabled ? detectSensitive(normalized, config.detectTypes) : [];
  const rewritten = config.rewriteEnabled ? rewriteSensitive(normalized, hits) : normalized;
  const hasHighRisk = hits.some((h) => h.risk === "high");
  const blocked = config.blockWhenHighRisk && hasHighRisk;

  const payloadBase = blocked ? "[BLOCKED_BY_GUARDRAIL]" : rewritten;
  const toolPayload = JSON.stringify({ query: payloadBase, topK: 5 }, null, 2);
  const sessionEntry = JSON.stringify(
    {
      role: "user",
      content: payloadBase,
      meta: {
        guardrail: {
          hitCount: hits.length,
          highRisk: hasHighRisk,
          types: [...new Set(hits.map((h) => h.type))],
        },
      },
    },
    null,
    2,
  );
  const logLine = `[guardrail] hits=${hits.length} highRisk=${hasHighRisk} blocked=${blocked}`;

  return {
    input,
    normalized,
    hits,
    rewritten,
    toolPayload,
    sessionEntry,
    logLine,
    blocked,
  };
}

function assertNoRawSecrets(params: { result: PipelineState; rawSecrets: string[] }) {
  for (const secret of params.rawSecrets) {
    if (params.result.rewritten.includes(secret)) {
      throw new Error(`rewritten 中仍然包含明文敏感数据: ${secret}`);
    }
    if (params.result.toolPayload.includes(secret)) {
      throw new Error(`toolPayload 中仍然包含明文敏感数据: ${secret}`);
    }
    if (params.result.sessionEntry.includes(secret)) {
      throw new Error(`sessionEntry 中仍然包含明文敏感数据: ${secret}`);
    }
  }
}

function writeArtifacts(result: PipelineState) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = join(ARTIFACT_DIR, `run-${timestamp}.json`);
  const latestPath = join(ARTIFACT_DIR, "latest.json");
  const payload = {
    runAt: new Date().toISOString(),
    config: guardrailSkillConfig,
    result,
  };
  writeFileSync(artifactPath, JSON.stringify(payload, null, 2));
  writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  return { artifactPath, latestPath };
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  POC 13: 敏感数据识别 + 重写 (Data Guardrails)           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("🧩 Skill 配置(模拟):");
  console.log(JSON.stringify(guardrailSkillConfig, null, 2));

  const rawInput =
    "客户手机号 13800138000，邮箱 alice.test@example.com，身份证 110105199003071234，API Key sk-1234567890abcdef12345678，请帮我做板块分析";

  console.log("\n📥 原始输入:");
  console.log(rawInput);

  const result = processPipeline(rawInput, guardrailSkillConfig);

  console.log("\n🔎 检测命中:");
  for (const hit of result.hits) {
    console.log(`  - ${hit.type} (${hit.risk}) ${hit.match} -> ${hit.replacement}`);
  }

  console.log("\n🧼 重写后文本:");
  console.log(result.rewritten);

  console.log("\n🛠 中间节点结果:");
  console.log("  [Tool Payload]");
  console.log(result.toolPayload);
  console.log("  [Session Entry]");
  console.log(result.sessionEntry);
  console.log("  [Log]");
  console.log(`  ${result.logLine}`);

  assertNoRawSecrets({
    result,
    rawSecrets: [
      "13800138000",
      "alice.test@example.com",
      "110105199003071234",
      "sk-1234567890abcdef12345678",
    ],
  });

  const { artifactPath, latestPath } = writeArtifacts(result);
  console.log("\n📦 验证产物:");
  console.log(`  - ${artifactPath}`);
  console.log(`  - ${latestPath}`);

  console.log("\n✅ 验证通过: 明文敏感数据没有进入重写后内容、工具载荷、会话落盘内容。\n");
}

main().catch((err) => {
  console.error("❌ POC 13 失败:", err);
  process.exitCode = 1;
});
