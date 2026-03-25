/**
 * POC 12: OpenAI 兼容 API — 用标准接口接入 Moltbot
 *
 * 演示: 通过 OpenAI 格式的 HTTP API 与 Moltbot 网关交互
 * 运行: bun poc/12-openai-compat-api.ts
 */

// ============================================================
// 1. 类型定义（OpenAI API 格式）
// ============================================================

type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type ChatCompletionRequest = {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
};

type ChatCompletionResponse = {
	id: string;
	object: "chat.completion";
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: ChatMessage;
		finish_reason: "stop" | "length" | "tool_calls";
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

type ChatCompletionChunk = {
	id: string;
	object: "chat.completion.chunk";
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: { role?: string; content?: string };
		finish_reason: "stop" | null;
	}>;
};

type EmbeddingRequest = {
	model: string;
	input: string | string[];
};

type EmbeddingResponse = {
	object: "list";
	data: Array<{
		object: "embedding";
		index: number;
		embedding: number[];
	}>;
	model: string;
	usage: { prompt_tokens: number; total_tokens: number };
};

type ModelsResponse = {
	object: "list";
	data: Array<{
		id: string;
		object: "model";
		created: number;
		owned_by: string;
	}>;
};

// ============================================================
// 2. 模拟 Moltbot 网关 HTTP 端点
// ============================================================

const GATEWAY_BASE = "http://localhost:18789";

/** 模拟 POST /v1/chat/completions（非流式） */
function simulateChatCompletion(req: ChatCompletionRequest): ChatCompletionResponse {
	const userMsg = req.messages.filter((m) => m.role === "user").pop();
	const query = userMsg?.content ?? "";

	// 模拟 Moltbot 的 AI 分析回复
	const mockReplies: Record<string, string> = {
		半导体: `半导体板块今日分析:

1. 政策面: 国务院芯片扶持新政落地，五年投入超5000亿
2. 资金面: 北向资金净流入半导体板块12.3亿
3. 技术面: 板块指数站上20日均线，MACD金叉
4. 龙头标的: 中芯国际(688981)、北方华创(002371)
5. 风险提示: 短期涨幅较大，注意回调风险

结论: 中期看多，建议逢低布局。`,
		新能源: `新能源板块快报:

宁德时代发布第二代全固态电池，能量密度500Wh/kg。
短期催化明显，但量产预期在2027年，需跟踪进展。`,
	};

	const matchedKey = Object.keys(mockReplies).find((k) => query.includes(k));
	const replyContent = matchedKey
		? mockReplies[matchedKey]
		: `收到您的问题: "${query.slice(0, 50)}"。Moltbot 正在分析中...`;

	return {
		id: "chatcmpl-moltbot-" + Date.now().toString(36),
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model: req.model,
		choices: [
			{
				index: 0,
				message: { role: "assistant", content: replyContent },
				finish_reason: "stop",
			},
		],
		usage: {
			prompt_tokens: 320,
			completion_tokens: 180,
			total_tokens: 500,
		},
	};
}

/** 模拟 POST /v1/chat/completions（SSE 流式） */
function simulateStreamingCompletion(req: ChatCompletionRequest): ChatCompletionChunk[] {
	const fullResponse = simulateChatCompletion(req);
	const fullText = fullResponse.choices[0].message.content;
	const id = fullResponse.id;
	const created = fullResponse.created;

	// 将完整回复拆分为 SSE 块（每块约 10-20 字符）
	const chunks: ChatCompletionChunk[] = [];
	const chunkSize = 15;

	// 首个块包含 role
	chunks.push({
		id,
		object: "chat.completion.chunk",
		created,
		model: req.model,
		choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
	});

	for (let i = 0; i < fullText.length; i += chunkSize) {
		chunks.push({
			id,
			object: "chat.completion.chunk",
			created,
			model: req.model,
			choices: [
				{
					index: 0,
					delta: { content: fullText.slice(i, i + chunkSize) },
					finish_reason: null,
				},
			],
		});
	}

	// 结束块
	chunks.push({
		id,
		object: "chat.completion.chunk",
		created,
		model: req.model,
		choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
	});

	return chunks;
}

/** 模拟 POST /v1/embeddings */
function simulateEmbeddings(req: EmbeddingRequest): EmbeddingResponse {
	const inputs = Array.isArray(req.input) ? req.input : [req.input];

	// 生成模拟向量（1536 维，归一化）
	function mockEmbedding(text: string): number[] {
		const vec: number[] = [];
		let seed = 0;
		for (const ch of text) seed += ch.charCodeAt(0);
		for (let i = 0; i < 1536; i++) {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			vec.push(((seed / 0x7fffffff) * 2 - 1) * 0.1);
		}
		// 归一化
		const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
		return vec.map((v) => Math.round((v / norm) * 1e6) / 1e6);
	}

	return {
		object: "list",
		data: inputs.map((text, index) => ({
			object: "embedding" as const,
			index,
			embedding: mockEmbedding(text),
		})),
		model: req.model,
		usage: {
			prompt_tokens: inputs.reduce((s, t) => s + t.length, 0),
			total_tokens: inputs.reduce((s, t) => s + t.length, 0),
		},
	};
}

/** 模拟 GET /v1/models */
function simulateListModels(): ModelsResponse {
	return {
		object: "list",
		data: [
			{ id: "moltbot-analyst-v3", object: "model", created: 1740000000, owned_by: "moltbot" },
			{ id: "moltbot-embed-v2", object: "model", created: 1739000000, owned_by: "moltbot" },
			{ id: "claude-sonnet-4-5-20250514", object: "model", created: 1738000000, owned_by: "anthropic" },
			{ id: "gpt-4o-2024-08-06", object: "model", created: 1737000000, owned_by: "openai" },
			{ id: "deepseek-r1", object: "model", created: 1736000000, owned_by: "deepseek" },
		],
	};
}

// ============================================================
// 3. 辅助函数: 请求构建与 SSE 解析
// ============================================================

/** 构建 curl 命令示例（展示用） */
function buildCurlExample(endpoint: string, body: Record<string, unknown>): string {
	return [
		`curl ${GATEWAY_BASE}${endpoint} \\`,
		`  -H "Content-Type: application/json" \\`,
		`  -H "Authorization: Bearer moltbot-api-key-xxx" \\`,
		`  -d '${JSON.stringify(body, null, 2)}'`,
	].join("\n");
}

/** 解析 SSE 数据行 */
function parseSSELine(line: string): ChatCompletionChunk | null {
	if (!line.startsWith("data: ")) return null;
	const payload = line.slice(6).trim();
	if (payload === "[DONE]") return null;
	return JSON.parse(payload) as ChatCompletionChunk;
}

/** 从 SSE 块序列重组完整文本 */
function reassembleFromChunks(chunks: ChatCompletionChunk[]): string {
	let text = "";
	for (const chunk of chunks) {
		const delta = chunk.choices[0]?.delta;
		if (delta?.content) text += delta.content;
	}
	return text;
}

// ============================================================
// 4. 运行演示
// ============================================================

async function main() {
	console.log("╔══════════════════════════════════════════════════════╗");
	console.log("║  POC 12: OpenAI 兼容 API — 用标准接口接入 Moltbot    ║");
	console.log("╚══════════════════════════════════════════════════════╝");

	// ── 场景 1: 列出可用模型 ────────────────────────────────
	console.log("\n\n📋 场景 1: GET /v1/models — 列出可用模型");
	console.log("─".repeat(60));

	console.log(`\n请求: GET ${GATEWAY_BASE}/v1/models\n`);

	const models = simulateListModels();
	console.log("响应:");
	for (const m of models.data) {
		const date = new Date(m.created * 1000).toISOString().slice(0, 10);
		console.log(`  [${m.owned_by.padEnd(10)}] ${m.id.padEnd(35)} (${date})`);
	}
	console.log(`\n  共 ${models.data.length} 个可用模型`);

	// ── 场景 2: Chat Completion（非流式） ───────────────────
	console.log("\n\n💬 场景 2: POST /v1/chat/completions — 非流式对话");
	console.log("─".repeat(60));

	const chatReq: ChatCompletionRequest = {
		model: "moltbot-analyst-v3",
		messages: [
			{ role: "system", content: "你是 Moltbot 投资分析助手，专注 A 股市场分析。" },
			{ role: "user", content: "分析今天半导体板块的走势和投资机会" },
		],
		temperature: 0.7,
		max_tokens: 1024,
		stream: false,
	};

	console.log("\n请求体:");
	console.log(buildCurlExample("/v1/chat/completions", chatReq as unknown as Record<string, unknown>));

	const chatResp = simulateChatCompletion(chatReq);
	console.log("\n响应:");
	console.log(`  ID: ${chatResp.id}`);
	console.log(`  模型: ${chatResp.model}`);
	console.log(`  用量: ${chatResp.usage.prompt_tokens} 输入 + ${chatResp.usage.completion_tokens} 输出 = ${chatResp.usage.total_tokens} tokens`);
	console.log(`\n  回复内容:`);
	for (const line of chatResp.choices[0].message.content.split("\n")) {
		console.log(`    ${line}`);
	}

	// ── 场景 3: Chat Completion（SSE 流式） ─────────────────
	console.log("\n\n🌊 场景 3: POST /v1/chat/completions — SSE 流式响应");
	console.log("─".repeat(60));

	const streamReq: ChatCompletionRequest = {
		...chatReq,
		messages: [
			{ role: "system", content: "你是 Moltbot 投资分析助手。" },
			{ role: "user", content: "新能源板块最新消息" },
		],
		stream: true,
	};

	console.log(`\n请求: POST ${GATEWAY_BASE}/v1/chat/completions (stream=true)\n`);

	const chunks = simulateStreamingCompletion(streamReq);
	console.log(`  收到 ${chunks.length} 个 SSE 块:\n`);

	// 显示前 5 个原始 SSE 数据行
	const previewCount = Math.min(5, chunks.length);
	for (let i = 0; i < previewCount; i++) {
		const sseData = `data: ${JSON.stringify(chunks[i])}`;
		const preview = sseData.length > 100 ? sseData.slice(0, 100) + "..." : sseData;
		console.log(`  ${preview}`);
	}
	if (chunks.length > previewCount) {
		console.log(`  ... (省略 ${chunks.length - previewCount - 1} 块)`);
		console.log(`  data: ${JSON.stringify(chunks[chunks.length - 1])}`);
	}
	console.log(`  data: [DONE]`);

	// 模拟 SSE 解析
	console.log("\n  解析 SSE 流:");
	const sseLines = [
		...chunks.map((c) => `data: ${JSON.stringify(c)}`),
		"data: [DONE]",
	];

	let reassembled = "";
	for (const line of sseLines) {
		const parsed = parseSSELine(line);
		if (parsed?.choices[0]?.delta?.content) {
			reassembled += parsed.choices[0].delta.content;
		}
	}
	console.log(`\n  重组后完整文本:`);
	for (const line of reassembled.split("\n")) {
		console.log(`    ${line}`);
	}

	// 验证
	const directText = reassembleFromChunks(chunks);
	console.log(`\n  完整性校验: ${directText === reassembled ? "通过" : "失败"}`);

	// ── 场景 4: Embeddings ──────────────────────────────────
	console.log("\n\n🔢 场景 4: POST /v1/embeddings — 向量化搜索");
	console.log("─".repeat(60));

	const embedReq: EmbeddingRequest = {
		model: "moltbot-embed-v2",
		input: ["半导体板块政策利好", "新能源汽车销量数据", "AI 算力需求增长"],
	};

	console.log("\n请求体:");
	console.log(buildCurlExample("/v1/embeddings", embedReq as unknown as Record<string, unknown>));

	const embedResp = simulateEmbeddings(embedReq);
	console.log("\n响应:");
	console.log(`  模型: ${embedResp.model}`);
	console.log(`  用量: ${embedResp.usage.total_tokens} tokens`);
	console.log(`  返回 ${embedResp.data.length} 个向量:\n`);

	const inputs = Array.isArray(embedReq.input) ? embedReq.input : [embedReq.input];
	for (const item of embedResp.data) {
		const vec = item.embedding;
		const preview = vec.slice(0, 5).map((v) => v.toFixed(6)).join(", ");
		console.log(`  [${item.index}] "${inputs[item.index]}"`);
		console.log(`      维度: ${vec.length}, 前5维: [${preview}, ...]`);
	}

	// 计算余弦相似度
	function cosineSimilarity(a: number[], b: number[]): number {
		let dot = 0, normA = 0, normB = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	console.log("\n  向量相似度矩阵:");
	for (let i = 0; i < embedResp.data.length; i++) {
		const sims: string[] = [];
		for (let j = 0; j < embedResp.data.length; j++) {
			const sim = cosineSimilarity(embedResp.data[i].embedding, embedResp.data[j].embedding);
			sims.push(sim.toFixed(4));
		}
		console.log(`    [${i}] ${sims.join("  ")}`);
	}

	// ── 场景 5: Python 集成示例 ─────────────────────────────
	console.log("\n\n🐍 场景 5: Python 客户端集成示例");
	console.log("─".repeat(60));

	const pythonExample = `
  # pip install openai
  from openai import OpenAI

  # 指向 Moltbot 网关，而非 OpenAI 官方
  client = OpenAI(
      base_url="${GATEWAY_BASE}/v1",
      api_key="moltbot-api-key-xxx",
  )

  # 对话分析
  resp = client.chat.completions.create(
      model="moltbot-analyst-v3",
      messages=[
          {"role": "system", "content": "你是 Moltbot 投资分析助手"},
          {"role": "user", "content": "分析半导体板块走势"},
      ],
      stream=True,
  )
  for chunk in resp:
      if chunk.choices[0].delta.content:
          print(chunk.choices[0].delta.content, end="")

  # 向量搜索
  emb = client.embeddings.create(
      model="moltbot-embed-v2",
      input=["半导体政策利好", "新能源销量"],
  )
  print(f"向量维度: {len(emb.data[0].embedding)}")

  # 模型列表
  models = client.models.list()
  for m in models.data:
      print(f"  {m.id} ({m.owned_by})")`;

	console.log(pythonExample);

	// ── 总结 ────────────────────────────────────────────────
	console.log(`\n\n${"═".repeat(60)}`);
	console.log("\n✅ OpenAI 兼容 API 演示完成");
	console.log("\n📌 Moltbot 网关 OpenAI 兼容层:");
	console.log("  - 完整支持 /v1/chat/completions（流式 + 非流式）");
	console.log("  - 支持 /v1/embeddings 用于向量化语义搜索");
	console.log("  - 支持 /v1/models 列出所有可用模型");
	console.log("  - 任何 OpenAI SDK 客户端（Python/Node/Go）可直接接入");
	console.log("  - SSE 流式响应格式与 OpenAI 完全兼容");
	console.log("  - 只需修改 base_url 即可从 OpenAI 迁移到 Moltbot");
}

main().catch(console.error);
