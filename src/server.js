import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import { scenarios, getScenarioById } from "./data/scenarios.js";
import { analyzeMessage } from "./services/feedbackService.js";
import { generateRoleplayReply } from "./services/agentService.js";
import { getProgressSummary, recordPractice } from "./services/progressService.js";
import { getProfile, getSession, saveProfile, upsertSession } from "./data/inMemoryStore.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString()
  });
});

app.get("/api/v1/scenarios", (_req, res) => {
  res.json({ scenarios });
});

app.post("/api/v1/session/init", (req, res) => {
  const { userId, profile = {} } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: "userId is required." });
    return;
  }

  const mergedProfile = {
    goal: "overseas-worklife",
    level: profile.level || config.defaultLevel,
    dailyMinutes: Number(profile.dailyMinutes || 15),
    preferredLocale: profile.preferredLocale || "zh-CN"
  };

  saveProfile(userId, mergedProfile);

  upsertSession(userId, {
    userId,
    history: [],
    updatedAt: new Date().toISOString()
  });

  res.json({
    userId,
    profile: mergedProfile,
    scenarios
  });
});

app.post("/api/v1/chat", async (req, res) => {
  const { userId, scenarioId, message, useChineseHint = true } = req.body || {};
  if (!userId || !scenarioId || !message) {
    res.status(400).json({ error: "userId, scenarioId and message are required." });
    return;
  }

  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found." });
    return;
  }

  const profile = getProfile(userId) || {
    goal: "overseas-worklife",
    level: config.defaultLevel,
    dailyMinutes: 15,
    preferredLocale: "zh-CN"
  };

  const session = getSession(userId) || { history: [] };
  const feedback = analyzeMessage(message, profile.level);
  const roleplay = await generateRoleplayReply({
    scenario,
    profile,
    useChineseHint,
    history: session.history.slice(-8),
    userMessage: message
  });

  const nextHistory = [
    ...session.history,
    { role: "user", text: message, ts: new Date().toISOString() },
    { role: "assistant", text: roleplay.text, ts: new Date().toISOString() }
  ].slice(-20);

  upsertSession(userId, {
    ...session,
    userId,
    history: nextHistory,
    updatedAt: new Date().toISOString()
  });

  const practiceRecord = recordPractice({
    userId,
    scenarioId,
    fluencyScore: feedback.fluencyScore,
    accuracyScore: feedback.accuracyScore,
    errorTags: feedback.errorTags
  });

  res.json({
    scenario: {
      id: scenario.id,
      title: scenario.title
    },
    assistant: {
      roleplayReply: roleplay.text,
      source: roleplay.source,
      fallbackReason: roleplay.fallbackReason || null
    },
    feedback: {
      quickFixes: feedback.quickFixes,
      rewrite: feedback.rewrite,
      coachTip: feedback.coachTip,
      vocabularyTips: feedback.vocabularyTips,
      fluencyScore: feedback.fluencyScore,
      accuracyScore: feedback.accuracyScore,
      errorTags: feedback.errorTags
    },
    practiceRecord
  });
});

app.get("/api/v1/progress/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "userId is required." });
    return;
  }

  const profile = getProfile(userId);
  const progress = getProgressSummary(userId);
  res.json({ profile, progress });
});

app.post("/api/v1/progress/record", (req, res) => {
  const { userId, scenarioId, fluencyScore, accuracyScore, errorTags = [], source = "manual" } = req.body || {};
  if (!userId || !scenarioId) {
    res.status(400).json({ error: "userId and scenarioId are required." });
    return;
  }

  const record = recordPractice({
    userId,
    scenarioId,
    fluencyScore: Number(fluencyScore || 0),
    accuracyScore: Number(accuracyScore || 0),
    errorTags,
    source
  });

  res.json({ record });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`English Worklife Agent running at http://localhost:${config.port}`);
});

