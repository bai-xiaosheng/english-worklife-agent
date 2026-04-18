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
import { buildDailyDashboard, getTodayKey } from "./services/dailyCoachService.js";
import { buildWeeklyReport } from "./services/weeklyCoachService.js";
import {
  buildHelpMessage,
  formatCheckinMessage,
  formatGoalMessage,
  formatImproveMessage,
  formatLearningStateMessage,
  formatPlanMessage,
  formatPracticeMessage,
  formatReviewMessage,
  formatStatusMessage,
  formatWeeklyMessage,
  parseLearningCommand
} from "./services/qqLearningBridgeService.js";
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
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      // eslint-disable-next-line no-console
      console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
  app.use(express.static(publicDir));

  async function computeLearningContext(userId) {
    const profile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const progress = await getProgressSummary(repository, userId);
    const records = await repository.getPracticeRecords(userId);
    const learningState = (await repository.getLearningState(userId)) || {
      userId,
      goal: "",
      contentFocus: "",
      planPreference: ""
    };
    const todayKey = getTodayKey(config.appTimeZone);
    const checkin = await repository.getDailyCheckin(userId, todayKey);
    const dailyDashboard = buildDailyDashboard({
      profile,
      progress,
      records,
      checkin,
      scenarios,
      timeZone: config.appTimeZone
    });
    const weeklyReport = buildWeeklyReport({
      records,
      progress,
      profile,
      dailyDashboard,
      timeZone: config.appTimeZone
    });

    return {
      profile,
      progress,
      records,
      learningState,
      todayKey,
      checkin,
      dailyDashboard,
      weeklyReport
    };
  }

  async function ensureBridgeUser({ source, externalUserId, displayName = "" }) {
    const existingIdentity = await repository.getExternalIdentity(source, externalUserId);
    if (existingIdentity?.userId) {
      const existingUser = await repository.getUserById(existingIdentity.userId);
      if (existingUser) return existingUser;
    }

    const syntheticEmail = `${source}_${externalUserId}@local.bot`;
    let user = await repository.getUserByEmail(syntheticEmail);

    if (!user) {
      const passwordHash = await hashPassword(config.bot.qqBridgePassword);
      user = await repository.createUser({
        email: syntheticEmail,
        passwordHash,
        displayName: displayName || `${source}-${externalUserId}`
      });
      await repository.saveProfile(user.id, buildDefaultProfile());
      await repository.upsertSession(user.id, { history: [] });
    }

    await repository.upsertExternalIdentity({
      source,
      externalUserId,
      userId: user.id,
      meta: {
        displayName: displayName || ""
      }
    });

    return user;
  }

  function inferContentFocus(goalText) {
    const text = String(goalText || "").toLowerCase();
    if (text.includes("interview")) return "interview and self-introduction";
    if (text.includes("meeting") || text.includes("work")) return "workplace conversation";
    if (text.includes("life") || text.includes("daily")) return "daily life communication";
    if (text.includes("travel")) return "travel and service scenarios";
    return "overseas work-life communication";
  }

  function inferPlanPreference(goalText) {
    const text = String(goalText || "").toLowerCase();
    if (text.includes("speaking") || text.includes("口语")) return "voice-first drills";
    if (text.includes("writing") || text.includes("写作")) return "rewrite-first drills";
    return "balanced daily loop";
  }

  function buildReviewNote(review = {}) {
    const wins = String(review.wins || "").trim();
    const blocker = String(review.blocker || "").trim();
    const nextAction = String(review.nextAction || "").trim();
    return [`wins=${wins || "-"}`, `blocker=${blocker || "-"}`, `next=${nextAction || "-"}`].join("; ");
  }

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

    const progress = await getProgressSummary(repository, userId);
    const todayKey = getTodayKey(config.appTimeZone);
    const todayCheckin = await repository.getDailyCheckin(userId, todayKey);
    const dailyDashboard = buildDailyDashboard({
      profile,
      progress,
      records: await repository.getPracticeRecords(userId),
      checkin: todayCheckin,
      scenarios,
      timeZone: config.appTimeZone
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
      practiceRecord,
      dailyHint: {
        focusScenarioId: dailyDashboard.focusScenarioId,
        topErrorTag: dailyDashboard.topErrorTag,
        nextTask: dailyDashboard.plan.tasks.find((item) => !item.completed)?.title || "Daily tasks completed"
      }
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

  app.get("/api/v1/daily/dashboard", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const profile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const progress = await getProgressSummary(repository, userId);
    const records = await repository.getPracticeRecords(userId);
    const todayKey = getTodayKey(config.appTimeZone);
    const checkin = await repository.getDailyCheckin(userId, todayKey);
    const dashboard = buildDailyDashboard({
      profile,
      progress,
      records,
      checkin,
      scenarios,
      timeZone: config.appTimeZone
    });

    res.json({ dashboard });
  });

  app.post("/api/v1/daily/checkin", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const completedTaskIds = Array.isArray(req.body?.completedTaskIds) ? req.body.completedTaskIds : [];
    const note = String(req.body?.note || "");
    const dateKey = String(req.body?.dateKey || getTodayKey(config.appTimeZone));

    const checkin = await repository.upsertDailyCheckin({
      userId,
      dateKey,
      completedTaskIds: completedTaskIds.filter((item) => typeof item === "string" && item.trim()),
      note
    });

    const profile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const progress = await getProgressSummary(repository, userId);
    const records = await repository.getPracticeRecords(userId);
    const dashboard = buildDailyDashboard({
      profile,
      progress,
      records,
      checkin,
      scenarios,
      timeZone: config.appTimeZone
    });

    res.json({ checkin, dashboard });
  });

  app.get("/api/v1/weekly/report", requireAuth, async (req, res) => {
    const userId = req.auth.userId;
    const profile = (await repository.getProfile(userId)) || buildDefaultProfile();
    const progress = await getProgressSummary(repository, userId);
    const records = await repository.getPracticeRecords(userId);
    const todayKey = getTodayKey(config.appTimeZone);
    const checkin = await repository.getDailyCheckin(userId, todayKey);
    const dailyDashboard = buildDailyDashboard({
      profile,
      progress,
      records,
      checkin,
      scenarios,
      timeZone: config.appTimeZone
    });

    const report = buildWeeklyReport({
      records,
      progress,
      profile,
      dailyDashboard,
      timeZone: config.appTimeZone
    });

    res.json({ report });
  });

  app.post("/api/v1/integrations/qqbot/message", async (req, res) => {
    const expectedSecret = config.bot.qqBridgeSecret;
    const providedSecret = String(req.headers["x-bot-secret"] || "");
    if (expectedSecret && providedSecret !== expectedSecret) {
      res.status(401).json({ error: "Unauthorized integration request." });
      return;
    }

    const source = String(req.body?.source || "qqbot");
    const externalUserId = String(
      req.body?.externalUserId || req.body?.userId || req.body?.senderId || ""
    ).trim();
    const displayName = String(req.body?.displayName || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!externalUserId || !text) {
      res.status(400).json({ error: "externalUserId and text are required." });
      return;
    }

    const user = await ensureBridgeUser({ source, externalUserId, displayName });
    const command = parseLearningCommand(text);
    let context = await computeLearningContext(user.id);

    if (command.type === "help" || command.type === "empty") {
      res.json({
        type: "help",
        reply: buildHelpMessage(),
        user: publicUser(user)
      });
      return;
    }

    if (command.type === "goal") {
      const goal = String(command.payload || "").trim();
      if (!goal) {
        res.json({
          type: "goal",
          reply: "Usage: /learn goal <your target>",
          user: publicUser(user)
        });
        return;
      }

      const learningState = await repository.upsertLearningState(user.id, {
        goal,
        contentFocus: inferContentFocus(goal),
        planPreference: inferPlanPreference(goal)
      });

      res.json({
        type: "goal",
        reply: formatGoalMessage(learningState),
        user: publicUser(user),
        learningState
      });
      return;
    }

    if (command.type === "content") {
      const contentFocus = String(command.payload || "").trim();
      if (!contentFocus) {
        res.json({
          type: "content",
          reply: "Usage: /learn content <focus area>",
          user: publicUser(user)
        });
        return;
      }
      const learningState = await repository.upsertLearningState(user.id, {
        contentFocus
      });
      res.json({
        type: "content",
        reply: formatLearningStateMessage(learningState),
        user: publicUser(user),
        learningState
      });
      return;
    }

    if (command.type === "preference") {
      const planPreference = String(command.payload || "").trim();
      if (!planPreference) {
        res.json({
          type: "preference",
          reply: "Usage: /learn preference <plan style>",
          user: publicUser(user)
        });
        return;
      }
      const learningState = await repository.upsertLearningState(user.id, {
        planPreference
      });
      res.json({
        type: "preference",
        reply: formatLearningStateMessage(learningState),
        user: publicUser(user),
        learningState
      });
      return;
    }

    if (command.type === "plan") {
      res.json({
        type: "plan",
        reply: formatPlanMessage({
          dashboard: context.dailyDashboard,
          learningState: context.learningState
        }),
        user: publicUser(user),
        dashboard: context.dailyDashboard
      });
      return;
    }

    if (command.type === "status") {
      res.json({
        type: "status",
        reply: formatStatusMessage({
          progress: context.progress,
          learningState: context.learningState,
          dashboard: context.dailyDashboard
        }),
        user: publicUser(user),
        progress: context.progress
      });
      return;
    }

    if (command.type === "weekly") {
      res.json({
        type: "weekly",
        reply: formatWeeklyMessage(context.weeklyReport),
        user: publicUser(user),
        report: context.weeklyReport
      });
      return;
    }

    if (command.type === "improve") {
      res.json({
        type: "improve",
        reply: formatImproveMessage({
          progress: context.progress,
          dashboard: context.dailyDashboard,
          weeklyReport: context.weeklyReport,
          learningState: context.learningState
        }),
        user: publicUser(user)
      });
      return;
    }

    if (command.type === "checkin") {
      const payload = command.payload || { completedTaskIds: [], note: "" };
      const checkin = await repository.upsertDailyCheckin({
        userId: user.id,
        dateKey: context.todayKey,
        completedTaskIds: payload.completedTaskIds || [],
        note: payload.note || ""
      });
      context = await computeLearningContext(user.id);
      res.json({
        type: "checkin",
        reply: formatCheckinMessage({
          checkin,
          dashboard: context.dailyDashboard
        }),
        user: publicUser(user),
        checkin
      });
      return;
    }

    if (command.type === "review") {
      const review = command.payload || { wins: "", blocker: "", nextAction: "" };
      const existingCheckin = await repository.getDailyCheckin(user.id, context.todayKey);
      await repository.upsertDailyCheckin({
        userId: user.id,
        dateKey: context.todayKey,
        completedTaskIds: existingCheckin?.completedTaskIds || [],
        note: buildReviewNote(review)
      });
      context = await computeLearningContext(user.id);
      res.json({
        type: "review",
        reply: formatReviewMessage({
          review,
          dashboard: context.dailyDashboard
        }),
        user: publicUser(user)
      });
      return;
    }

    if (command.type === "practice") {
      const message = String(command.payload || "").trim();
      if (!message) {
        res.json({
          type: "practice",
          reply: "Please send one English sentence to practice.",
          user: publicUser(user)
        });
        return;
      }

      const scenarioId = context.dailyDashboard.focusScenarioId || "team-standup";
      const scenario = getScenarioById(scenarioId) || scenarios[0];
      const session = (await repository.getSession(user.id)) || { history: [] };
      const feedback = analyzeMessage(message, context.profile.level);
      const roleplay = await generateRoleplayReply({
        scenario,
        profile: context.profile,
        useChineseHint: true,
        history: session.history.slice(-8),
        userMessage: message
      });

      const nowIso = new Date().toISOString();
      const nextHistory = [
        ...session.history,
        { role: "user", text: message, ts: nowIso },
        { role: "assistant", text: roleplay.text, ts: nowIso }
      ].slice(-20);

      await repository.upsertSession(user.id, {
        history: nextHistory
      });

      await recordPractice(repository, {
        userId: user.id,
        scenarioId: scenario.id,
        fluencyScore: feedback.fluencyScore,
        accuracyScore: feedback.accuracyScore,
        errorTags: feedback.errorTags,
        source: "qqbot"
      });

      context = await computeLearningContext(user.id);
      const assistantPayload = {
        roleplayReply: roleplay.text
      };
      const dailyHint = {
        nextTask: context.dailyDashboard.plan.tasks.find((item) => !item.completed)?.title || "Daily tasks completed"
      };

      res.json({
        type: "practice",
        reply: formatPracticeMessage({
          assistant: assistantPayload,
          feedback,
          dailyHint
        }),
        user: publicUser(user),
        feedback
      });
      return;
    }

    res.json({
      type: "help",
      reply: buildHelpMessage(),
      user: publicUser(user)
    });
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
