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

if (process.exitCode === 1) {
  process.exit(1);
}

console.log("All tests passed.");

