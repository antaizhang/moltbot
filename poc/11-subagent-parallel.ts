/**
 * POC 11: 子Agent并行分析 — 多板块同时分析
 *
 * 演示: 主Agent生成5个子Agent，分别分析5个板块，最后汇总推送
 * 运行: bun poc/11-subagent-parallel.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "data");
const sectors = JSON.parse(readFileSync(join(DATA_DIR, "sectors.json"), "utf-8"));
const newsSamples = JSON.parse(readFileSync(join(DATA_DIR, "news-samples.json"), "utf-8"));

// ============================================================
// 1. 模拟新闻数据索引（板块 → 新闻映射）
// ============================================================

const sectorNewsMap: Record<string, typeof newsSamples> = {
	半导体: [newsSamples[0]],
	新能源: [newsSamples[1]],
	AI人工智能: [newsSamples[2]],
	消费白酒: [newsSamples[3]],
	医药生物: [newsSamples[4]],
};

const sectorImpactMap: Record<string, { level: string; score: number; summary: string }> = {
	半导体: {
		level: "强利好",
		score: 9,
		summary: "国务院芯片扶持政策力度超预期，五年5000亿投入直接利好半导体设备和晶圆代工",
	},
	新能源: {
		level: "中性偏好",
		score: 6,
		summary: "宁德时代固态电池技术突破意义重大，但量产要到2027年，短期催化有限",
	},
	AI人工智能: {
		level: "利好",
		score: 8,
		summary: "英伟达B300发布提升算力3倍，中国区合规版Q2上市，国内AI服务器厂商直接受益",
	},
	消费白酒: {
		level: "利好",
		score: 7,
		summary: "茅台时隔三年首次提价5%，带动白酒板块估值修复预期，高端白酒最为受益",
	},
	医药生物: {
		level: "强利好",
		score: 9,
		summary: "恒瑞PD-1获FDA突破性疗法认定，标志国产创新药出海里程碑，板块情绪大幅提振",
	},
};

// ============================================================
// 2. 子Agent定义 — 每个子Agent独立完成板块分析
// ============================================================

type SubAgentResult = {
	sectorName: string;
	sessionId: string;
	steps: { action: string; detail: string }[];
	news: { title: string; source: string; summary: string }[];
	impact: { level: string; score: number; summary: string };
	topStocks: { code: string; name: string; role: string }[];
};

async function spawnSubAgent(sectorName: string): Promise<SubAgentResult> {
	const sessionId = `sub-${sectorName}-${Date.now().toString(36)}`;
	const sector = sectors[sectorName] as { name: string; tags: string[]; stocks: { code: string; name: string; role: string }[] };
	const steps: { action: string; detail: string }[] = [];

	// 模拟子Agent独立执行过程（每个子Agent有隔离的session）
	steps.push({
		action: "初始化会话",
		detail: `子Agent [${sessionId}] 启动，目标板块: ${sectorName}`,
	});

	// 步骤1: 模拟 web_search — 搜索板块新闻
	const delay = 50 + Math.floor(Math.random() * 150); // 模拟网络延迟
	await new Promise((r) => setTimeout(r, delay));
	const news = sectorNewsMap[sectorName] ?? [];
	steps.push({
		action: "web_search",
		detail: `搜索 "${sectorName} 最新新闻 2026" → 找到 ${news.length} 条`,
	});

	// 步骤2: 模拟 AI 分析影响
	await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 80)));
	const impact = sectorImpactMap[sectorName] ?? { level: "中性", score: 5, summary: "暂无明显催化" };
	steps.push({
		action: "analyze_impact",
		detail: `AI分析完成 → 影响: ${impact.level} (${impact.score}/10)`,
	});

	// 步骤3: 匹配板块龙头股
	const topStocks = sector.stocks.slice(0, 2);
	steps.push({
		action: "match_stocks",
		detail: `匹配龙头股: ${topStocks.map((s) => `${s.name}(${s.code})`).join(", ")}`,
	});

	// 步骤4: 通过announce上报结果
	steps.push({
		action: "announce",
		detail: `子Agent [${sessionId}] 分析完成，结果已上报主Agent`,
	});

	return {
		sectorName,
		sessionId,
		steps,
		news: news.map((n: any) => ({ title: n.title, source: n.source, summary: n.summary })),
		impact,
		topStocks,
	};
}

// ============================================================
// 3. 主Agent — 调度、收集、汇总、推送
// ============================================================

async function mainAgent() {
	const prompt = "分析今天所有板块的最新新闻";
	const sectorNames = Object.keys(sectors);

	console.log("╔══════════════════════════════════════════════════════════╗");
	console.log("║  POC 11: 子Agent并行分析 — 多板块同时分析                 ║");
	console.log("╚══════════════════════════════════════════════════════════╝");

	console.log(`\n👤 用户指令: "${prompt}"\n`);
	console.log("━".repeat(60));

	// ── 阶段 1: 主Agent规划 ──
	console.log("\n🧠 主Agent 思考:");
	console.log("   用户要求分析所有板块新闻。共有5个板块，");
	console.log("   为提高效率，生成5个子Agent并行分析。\n");

	console.log("📋 执行计划:");
	for (const name of sectorNames) {
		console.log(`   → 子Agent: ${name}`);
	}
	console.log("");
	console.log("━".repeat(60));

	// ── 阶段 2: 并行派发子Agent ──
	console.log("\n⚡ 阶段2: 并行派发子Agent (Promise.all)\n");

	const startTime = Date.now();
	const results = await Promise.all(sectorNames.map((name) => spawnSubAgent(name)));
	const elapsed = Date.now() - startTime;

	// 打印每个子Agent的执行过程
	for (const result of results) {
		console.log(`┌─── 子Agent: ${result.sectorName} [${result.sessionId}] ───`);
		for (const step of result.steps) {
			console.log(`│  ${step.action}: ${step.detail}`);
		}
		console.log(`└${"─".repeat(55)}`);
		console.log("");
	}

	console.log(`   ⏱  全部子Agent完成，耗时: ${elapsed}ms (并行执行)\n`);
	console.log("━".repeat(60));

	// ── 阶段 3: 主Agent汇总 ──
	console.log("\n📊 阶段3: 主Agent汇总所有子Agent结果\n");

	// 按影响评分排序
	const sorted = [...results].sort((a, b) => b.impact.score - a.impact.score);

	let report = "📈 今日全板块新闻分析报告\n\n";

	for (let i = 0; i < sorted.length; i++) {
		const r = sorted[i]!;
		const emoji = r.impact.score >= 8 ? "🔴" : r.impact.score >= 6 ? "🟡" : "⚪";
		report += `${i + 1}. ${emoji} ${r.sectorName} — ${r.impact.level} (${r.impact.score}/10)\n`;
		report += `   ${r.impact.summary}\n`;
		report += `   关注: ${r.topStocks.map((s) => `${s.name}(${s.code})`).join("、")}\n`;
		if (r.news.length > 0) {
			report += `   📰 ${r.news[0]!.title}\n`;
		}
		report += "\n";
	}

	report += "──────────────────────────────\n";
	report += `分析时间: ${new Date().toLocaleString("zh-CN")}`;

	// 打印汇总报告
	for (const line of report.split("\n")) {
		console.log(`   ${line}`);
	}

	console.log("\n" + "━".repeat(60));

	// ── 阶段 4: 推送到 Telegram ──
	console.log("\n📤 阶段4: 推送到 Telegram\n");
	console.log("   🔧 工具调用: message({ channel: \"telegram\", target: \"user_123456\" })");
	console.log("   📦 返回结果: 已发送到 telegram:user_123456");

	console.log("\n" + "━".repeat(60));

	// ── 运行统计 ──
	console.log(`\n📊 运行统计:`);
	console.log(`   子Agent数量: ${results.length}`);
	console.log(`   执行方式: Promise.all 并行`);
	console.log(`   总耗时: ${elapsed}ms`);
	const totalSteps = results.reduce((sum, r) => sum + r.steps.length, 0);
	console.log(`   子Agent总步骤: ${totalSteps}`);
	console.log(`   主Agent步骤: 4 (规划 → 派发 → 汇总 → 推送)`);

	console.log("\n✅ 子Agent并行分析演示完成");
	console.log("\n📌 关键点:");
	console.log("  每个子Agent拥有独立的session，互不干扰");
	console.log("  Promise.all 实现真正的并行执行，大幅提升效率");
	console.log("  子Agent通过 announce 上报结果，主Agent统一收集");
	console.log("  主Agent汇总排序后生成综合报告，一次性推送");
}

mainAgent().catch(console.error);
