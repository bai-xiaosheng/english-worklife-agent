import assert from "node:assert/strict";

import { analyzeMessage } from "../src/services/feedbackService.js";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword
} from "../src/services/authService.js";
import { buildDailyDashboard } from "../src/services/dailyCoachService.js";
import { buildWeeklyReport } from "../src/services/weeklyCoachService.js";
import {
  parseLearningCommand,
  formatImproveMessage,
  formatPlanMessage
} from "../src/services/qqLearningBridgeService.js";

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await run("flags mixed Chinese content", async () => {
  const result = analyzeMessage("I think this plan is good, 我也认同", "A2");
  assert.ok(result.errorTags.includes("native-language-mix"));
  assert.ok(result.quickFixes.length >= 1);
});

await run("rewrites common grammar issues", async () => {
  const result = analyzeMessage("I very like this idea", "A2");
  assert.equal(result.rewrite, "I really like this idea");
  assert.ok(result.errorTags.includes("word-order"));
});

await run("returns zero scores for empty input", async () => {
  const result = analyzeMessage("   ", "A2");
  assert.equal(result.fluencyScore, 0);
  assert.equal(result.accuracyScore, 0);
});

await run("normalizes email and validates credentials", async () => {
  const result = validateCredentials({ email: "  User@Example.com ", password: "12345678" });
  assert.equal(result.email, "user@example.com");
  assert.equal(result.errors.length, 0);
});

await run("rejects short password", async () => {
  const result = validateCredentials({ email: "user@example.com", password: "123" });
  assert.ok(result.errors.some((msg) => msg.includes("at least 8")));
});

await run("hash and verify password", async () => {
  const password = "strong-password";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  const ok = await verifyPassword(password, hash);
  assert.equal(ok, true);
});

await run("normalizeEmail handles null safely", async () => {
  assert.equal(normalizeEmail(null), "");
});

await run("daily dashboard creates checklist and streak", async () => {
  const now = new Date();
  const records = [
    {
      createdAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      scenarioId: "team-standup",
      errorTags: ["question-form"]
    },
    {
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      scenarioId: "renting-apartment",
      errorTags: ["question-form"]
    }
  ];
  const dashboard = buildDailyDashboard({
    profile: { dailyMinutes: 15 },
    progress: { topErrors: [{ tag: "question-form", count: 3 }] },
    records,
    checkin: { completedTaskIds: ["warmup-voice"], note: "good" },
    scenarios: [{ id: "renting-apartment" }, { id: "team-standup" }],
    timeZone: "Asia/Shanghai"
  });

  assert.ok(dashboard.plan.tasks.length >= 3);
  assert.equal(dashboard.focusScenarioId, "renting-apartment");
  assert.ok(dashboard.streakDays >= 1);
  assert.equal(dashboard.plan.note, "good");
});

await run("weekly report summarizes stats and next plan", async () => {
  const now = new Date();
  const records = [
    {
      createdAt: now.toISOString(),
      scenarioId: "team-standup",
      fluencyScore: 77,
      accuracyScore: 81
    },
    {
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      scenarioId: "team-standup",
      fluencyScore: 75,
      accuracyScore: 79
    }
  ];

  const dailyDashboard = buildDailyDashboard({
    profile: { dailyMinutes: 15 },
    progress: { topErrors: [{ tag: "word-order", count: 2 }] },
    records,
    checkin: null,
    scenarios: [{ id: "team-standup" }],
    timeZone: "Asia/Shanghai"
  });

  const report = buildWeeklyReport({
    records,
    progress: { topErrors: [{ tag: "word-order", count: 2 }] },
    profile: { dailyMinutes: 15 },
    dailyDashboard,
    timeZone: "Asia/Shanghai"
  });

  assert.ok(report.stats.totalPractices >= 1);
  assert.ok(report.nextWeekPlan.length >= 3);
  assert.ok(typeof report.summary === "string");
});

await run("qq learning command parser handles goal and practice", async () => {
  const goal = parseLearningCommand("/learn goal Speak clearly in meetings");
  const practice = parseLearningCommand("I will share project updates in standup.");
  assert.equal(goal.type, "goal");
  assert.equal(goal.payload, "Speak clearly in meetings");
  assert.equal(practice.type, "practice");
});

await run("qq learning formatter returns plan text", async () => {
  const text = formatPlanMessage({
    learningState: { goal: "Work-life communication" },
    dashboard: {
      todayKey: "2026-04-18",
      streakDays: 3,
      focusScenarioId: "team-standup",
      topErrorTag: "word-order",
      plan: {
        tasks: [
          { id: "warmup-voice", title: "Warm-up", completed: false },
          { id: "repair-weakness", title: "Repair", completed: true }
        ]
      }
    }
  });
  assert.ok(text.includes("Goal:"));
  assert.ok(text.includes("Focus scenario:"));
});

await run("qq learning command parser supports Chinese aliases", async () => {
  const goal = parseLearningCommand("学习目标 海外工作沟通");
  const content = parseLearningCommand("学习内容 会议沟通和small talk");
  const plan = parseLearningCommand("今日计划");
  const checkin = parseLearningCommand("打卡 warmup-voice,repair-weakness|今天状态不错");

  assert.equal(goal.type, "goal");
  assert.equal(content.type, "content");
  assert.equal(plan.type, "plan");
  assert.equal(checkin.type, "checkin");
  assert.deepEqual(checkin.payload.completedTaskIds, ["warmup-voice", "repair-weakness"]);
});

await run("qq learning improve formatter includes action and priority", async () => {
  const text = formatImproveMessage({
    learningState: { goal: "Work and life communication" },
    progress: { topErrors: [{ tag: "question-form", count: 4 }] },
    dashboard: { focusScenarioId: "team-standup" },
    weeklyReport: {
      nextWeekPlan: [
        { title: "Loop", action: "Do 15 min daily" },
        { title: "Repair", action: "Fix question-form with 5 examples" }
      ]
    }
  });

  assert.ok(text.includes("Improvement suggestions:"));
  assert.ok(text.includes("question-form"));
  assert.ok(text.includes("Action now:"));
});

if (process.exitCode === 1) {
  process.exit(1);
}

console.log("All tests passed.");
