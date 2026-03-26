type SensitiveType = "phone" | "email" | "id-cn" | "api-key";

type Hit = {
  type: SensitiveType;
  raw: string;
  masked: string;
};

const detectors: Array<{
  type: SensitiveType;
  regex: RegExp;
  mask: (raw: string) => string;
}> = [
  {
    type: "phone",
    regex: /(?<!\d)(1[3-9]\d{9})(?!\d)/g,
    mask: (raw) => `${raw.slice(0, 3)}****${raw.slice(-4)}`,
  },
  {
    type: "email",
    regex: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    mask: (raw) => {
      const [name, domain] = raw.split("@");
      if (!name || !domain) {
        return "[EMAIL_REDACTED]";
      }
      return `${name.slice(0, 2)}***@${domain}`;
    },
  },
  {
    type: "id-cn",
    regex: /\b\d{17}[\dXx]\b/g,
    mask: (raw) => `${raw.slice(0, 6)}********${raw.slice(-4)}`,
  },
  {
    type: "api-key",
    regex: /\bsk-[A-Za-z0-9]{16,}\b/g,
    mask: (raw) => `${raw.slice(0, 6)}********${raw.slice(-4)}`,
  },
];

function rewrite(content: string): { text: string; hits: Hit[] } {
  const hits: Hit[] = [];
  let next = content;

  for (const detector of detectors) {
    for (const m of content.matchAll(detector.regex)) {
      const raw = m[0];
      const masked = detector.mask(raw);
      hits.push({ type: detector.type, raw, masked });
      next = next.split(raw).join(masked);
    }
  }

  return { text: next, hits };
}

const handler = async (event: {
  type: string;
  action: string;
  context: Record<string, unknown>;
  messages: string[];
}) => {
  const rawContent = String(event.context.content ?? "");
  if (!rawContent) {
    return;
  }

  const { text, hits } = rewrite(rawContent);
  if (hits.length === 0) {
    return;
  }

  event.context.content = text;
  event.context.guardrail = {
    hits: hits.length,
    types: [...new Set(hits.map((h) => h.type))],
  };

  event.messages.push(
    `🛡️ guardrail: masked ${hits.length} sensitive value(s) [${[...new Set(hits.map((h) => h.type))].join(", ")}]`,
  );
};

export default handler;
