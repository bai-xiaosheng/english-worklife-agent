import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import { scenarios, getScenarioById } from "./data/scenarios.js";
import { createRepository } from "./data/repository.js";
import { analyzeMessage } from "./services/feedbackService.js";
import { generateRoleplayReply } from "./services/agentService.js";
import { getProgressSummary, recordPractice } from "./services/progressService.js";
import {
  hashPassword,
  normalizeEmail,
  publicUser,
  signAuthToken,
  validateCredentials,
  verifyPassword
} from "./services/authService.js";
import { requireAuth } from "./middleware/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

function buildDefaultProfile(override = {}) {
  return {
    goal: "overseas-worklife",
    level: override.level || config.defaultLevel,
    dailyMinutes: Number(override.dailyMinutes || 15),
    preferredLocale: override.preferredLocale || "zh-CN"
  };
}

async function createApp() {
  const repository = await createRepository();
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      now: new Date().toISOString(),
      storage: repository.mode
    });
  });

  app.get("/api/v1/scenarios", (_req, res) => {
    res.json({ scenarios });
  });

  app.post("/api/v1/auth/register", async (req, res) => {
    const { email, password, displayName = "", profile = {} } = req.body || {};
    const validated = validateCredentials({ email, password });
    if (validated.errors.length) {
      res.status(400).json({ error: validated.errors.join(" ") });
      return;
    }

    const existingUser = await repository.getUserByEmail(validated.email);
    if (existingUser) {
      res.status(409).json({ error: "Email already registered." });
      return;
    }

    const passwordHash = await hashPassword(validated.password);
    const user = await repository.createUser({
      email: validated.email,
      passwordHash,
      displayName: String(displayName || "").trim()
    });
    const mergedProfile = buildDefaultProfile(profile);
    await repository.saveProfile(user.id, mergedProfile);
    await repository.upsertSession(user.id, { history: [] });

    const token = signAuthToken(user);
    res.status(201).json({
      token,
      user: publicUser(user),
      profile: mergedProfile
    });
  });

  app.post("/api/v1/auth/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = await repository.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const matched = await verifyPassword(password, user.passwordHash);
    if (!matched) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signAuthToken(user);
    const profile = (await repository.getProfile(user.id)) || buildDefaultProfile();
    res.json({
      token,
      user: publicUser(user),
      profile
    });
  });

  app.get("/api/v1/auth/me", requireAuth, async (req, res) => {
    const user = await repository.getUserById(req.auth.userId);
    if (!user) {
      res.status(401).json({ error: "User no longer exists." });
      return;
    }

    const profile = (await repository.getProfile(user.id)) || buildDefaultProfile();
    res.json({
      user: publicUser(user),
      profile
    });
  });

  app.post("/api/v1/session/init", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const { profile = {} } = req.body || {};
    const currentProfile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const mergedProfile = buildDefaultProfile({
      ...currentProfile,
      ...profile
    });

    await repository.saveProfile(userId, mergedProfile);
    await repository.upsertSession(userId, { history: [] });

    res.json({
      userId,
      profile: mergedProfile,
      scenarios
    });
  });

  app.post("/api/v1/chat", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const { scenarioId, message, useChineseHint = true } = req.body || {};
    if (!scenarioId || !message) {
      res.status(400).json({ error: "scenarioId and message are required." });
      return;
    }

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      res.status(404).json({ error: "Scenario not found." });
      return;
    }

    const profile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const session = (await repository.getSession(userId)) || { history: [] };
    const feedback = analyzeMessage(message, profile.level);
    const roleplay = await generateRoleplayReply({
      scenario,
      profile,
      useChineseHint,
      history: session.history.slice(-8),
      userMessage: message
    });

    const nowIso = new Date().toISOString();
    const nextHistory = [
      ...session.history,
      { role: "user", text: message, ts: nowIso },
      { role: "assistant", text: roleplay.text, ts: nowIso }
    ].slice(-20);

    await repository.upsertSession(userId, {
      history: nextHistory
    });

    const practiceRecord = await recordPractice(repository, {
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

  app.get("/api/v1/progress/me", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const profile = await repository.getProfile(userId);
    const progress = await getProgressSummary(repository, userId);
    res.json({ profile, progress });
  });

  app.post("/api/v1/progress/record", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const { scenarioId, fluencyScore, accuracyScore, errorTags = [], source = "manual" } = req.body || {};
    if (!scenarioId) {
      res.status(400).json({ error: "scenarioId is required." });
      return;
    }

    const record = await recordPractice(repository, {
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

  return { app, repository };
}

async function start() {
  const { app, repository } = await createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`English Worklife Agent running at http://localhost:${config.port} (${repository.mode})`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});

