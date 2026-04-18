import { randomUUID } from "crypto";
import { Pool } from "pg";

import { config } from "../config.js";

function createMemoryRepository() {
  const usersById = new Map();
  const usersByEmail = new Map();
  const profiles = new Map();
  const sessions = new Map();
  const practiceByUser = new Map();
  const dailyCheckins = new Map();
  const externalIdentityStore = new Map();
  const learningStateStore = new Map();

  return {
    mode: "memory",
    async init() {
      return;
    },
    async createUser({ email, passwordHash, displayName = "" }) {
      if (usersByEmail.has(email)) {
        throw new Error("user-already-exists");
      }

      const user = {
        id: randomUUID(),
        email,
        passwordHash,
        displayName,
        createdAt: new Date().toISOString()
      };
      usersById.set(user.id, user);
      usersByEmail.set(email, user);
      return user;
    },
    async getUserByEmail(email) {
      return usersByEmail.get(email) || null;
    },
    async getUserById(userId) {
      return usersById.get(userId) || null;
    },
    async saveProfile(userId, profile) {
      const merged = { ...profile, userId, updatedAt: new Date().toISOString() };
      profiles.set(userId, merged);
      return merged;
    },
    async getProfile(userId) {
      return profiles.get(userId) || null;
    },
    async upsertSession(userId, session) {
      const next = { ...session, userId, updatedAt: new Date().toISOString() };
      sessions.set(userId, next);
      return next;
    },
    async getSession(userId) {
      return sessions.get(userId) || null;
    },
    async addPracticeRecord(record) {
      const userRecords = practiceByUser.get(record.userId) || [];
      userRecords.push(record);
      practiceByUser.set(record.userId, userRecords);
      return record;
    },
    async getPracticeRecords(userId) {
      return [...(practiceByUser.get(userId) || [])];
    },
    async getExternalIdentity(source, externalUserId) {
      return externalIdentityStore.get(`${source}::${externalUserId}`) || null;
    },
    async upsertExternalIdentity({ source, externalUserId, userId, meta = {} }) {
      const key = `${source}::${externalUserId}`;
      const next = {
        source,
        externalUserId,
        userId,
        meta,
        updatedAt: new Date().toISOString()
      };
      externalIdentityStore.set(key, next);
      return next;
    },
    async getLearningState(userId) {
      return learningStateStore.get(userId) || null;
    },
    async upsertLearningState(userId, patch = {}) {
      const current = learningStateStore.get(userId) || {
        userId,
        goal: "",
        contentFocus: "",
        planPreference: "",
        updatedAt: new Date().toISOString()
      };

      const next = {
        ...current,
        ...patch,
        userId,
        updatedAt: new Date().toISOString()
      };
      learningStateStore.set(userId, next);
      return next;
    },
    async getDailyCheckin(userId, dateKey) {
      return dailyCheckins.get(`${userId}::${dateKey}`) || null;
    },
    async upsertDailyCheckin({ userId, dateKey, completedTaskIds = [], note = "" }) {
      const key = `${userId}::${dateKey}`;
      const next = {
        userId,
        dateKey,
        completedTaskIds: [...new Set(completedTaskIds)],
        note: String(note || ""),
        updatedAt: new Date().toISOString()
      };
      dailyCheckins.set(key, next);
      return next;
    }
  };
}

function createPostgresRepository() {
  const pool = new Pool({
    connectionString: config.databaseUrl
  });

  return {
    mode: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          goal TEXT NOT NULL,
          level TEXT NOT NULL,
          daily_minutes INT NOT NULL,
          preferred_locale TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sessions (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          history JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS practice_records (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          scenario_id TEXT NOT NULL,
          fluency_score INT NOT NULL,
          accuracy_score INT NOT NULL,
          error_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          source TEXT NOT NULL DEFAULT 'chat',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS daily_checkins (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          checkin_date DATE NOT NULL,
          completed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          note TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, checkin_date)
        );

        CREATE TABLE IF NOT EXISTS external_identities (
          source TEXT NOT NULL,
          external_user_id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (source, external_user_id)
        );

        CREATE TABLE IF NOT EXISTS learning_states (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          goal TEXT NOT NULL DEFAULT '',
          content_focus TEXT NOT NULL DEFAULT '',
          plan_preference TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    },
    async createUser({ email, passwordHash, displayName = "" }) {
      const user = {
        id: randomUUID(),
        email,
        passwordHash,
        displayName
      };

      await pool.query(
        `
          INSERT INTO users (id, email, password_hash, display_name)
          VALUES ($1, $2, $3, $4)
        `,
        [user.id, user.email, user.passwordHash, user.displayName]
      );

      return {
        ...user,
        createdAt: new Date().toISOString()
      };
    },
    async getUserByEmail(email) {
      const result = await pool.query(
        `
          SELECT id, email, password_hash, display_name, created_at
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        createdAt: row.created_at?.toISOString?.() || row.created_at
      };
    },
    async getUserById(userId) {
      const result = await pool.query(
        `
          SELECT id, email, password_hash, display_name, created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [userId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        createdAt: row.created_at?.toISOString?.() || row.created_at
      };
    },
    async saveProfile(userId, profile) {
      await pool.query(
        `
          INSERT INTO profiles (user_id, goal, level, daily_minutes, preferred_locale, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            goal = EXCLUDED.goal,
            level = EXCLUDED.level,
            daily_minutes = EXCLUDED.daily_minutes,
            preferred_locale = EXCLUDED.preferred_locale,
            updated_at = NOW()
        `,
        [userId, profile.goal, profile.level, profile.dailyMinutes, profile.preferredLocale]
      );
      return this.getProfile(userId);
    },
    async getProfile(userId) {
      const result = await pool.query(
        `
          SELECT user_id, goal, level, daily_minutes, preferred_locale, updated_at
          FROM profiles
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        goal: row.goal,
        level: row.level,
        dailyMinutes: row.daily_minutes,
        preferredLocale: row.preferred_locale,
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async upsertSession(userId, session) {
      const history = JSON.stringify(session.history || []);
      await pool.query(
        `
          INSERT INTO sessions (user_id, history, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            history = EXCLUDED.history,
            updated_at = NOW()
        `,
        [userId, history]
      );
      return this.getSession(userId);
    },
    async getSession(userId) {
      const result = await pool.query(
        `
          SELECT user_id, history, updated_at
          FROM sessions
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        history: row.history || [],
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async addPracticeRecord(record) {
      const result = await pool.query(
        `
          INSERT INTO practice_records (user_id, scenario_id, fluency_score, accuracy_score, error_tags, source)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6)
          RETURNING id, user_id, scenario_id, fluency_score, accuracy_score, error_tags, source, created_at
        `,
        [
          record.userId,
          record.scenarioId,
          record.fluencyScore,
          record.accuracyScore,
          JSON.stringify(record.errorTags || []),
          record.source || "chat"
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        scenarioId: row.scenario_id,
        fluencyScore: row.fluency_score,
        accuracyScore: row.accuracy_score,
        errorTags: row.error_tags || [],
        source: row.source,
        createdAt: row.created_at?.toISOString?.() || row.created_at
      };
    },
    async getPracticeRecords(userId) {
      const result = await pool.query(
        `
          SELECT id, user_id, scenario_id, fluency_score, accuracy_score, error_tags, source, created_at
          FROM practice_records
          WHERE user_id = $1
          ORDER BY created_at ASC
        `,
        [userId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        scenarioId: row.scenario_id,
        fluencyScore: row.fluency_score,
        accuracyScore: row.accuracy_score,
        errorTags: row.error_tags || [],
        source: row.source,
        createdAt: row.created_at?.toISOString?.() || row.created_at
      }));
    },
    async getExternalIdentity(source, externalUserId) {
      const result = await pool.query(
        `
          SELECT source, external_user_id, user_id, meta, updated_at
          FROM external_identities
          WHERE source = $1 AND external_user_id = $2
          LIMIT 1
        `,
        [source, externalUserId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        source: row.source,
        externalUserId: row.external_user_id,
        userId: row.user_id,
        meta: row.meta || {},
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async upsertExternalIdentity({ source, externalUserId, userId, meta = {} }) {
      const result = await pool.query(
        `
          INSERT INTO external_identities (source, external_user_id, user_id, meta, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, NOW())
          ON CONFLICT (source, external_user_id)
          DO UPDATE SET
            user_id = EXCLUDED.user_id,
            meta = EXCLUDED.meta,
            updated_at = NOW()
          RETURNING source, external_user_id, user_id, meta, updated_at
        `,
        [source, externalUserId, userId, JSON.stringify(meta || {})]
      );
      const row = result.rows[0];
      return {
        source: row.source,
        externalUserId: row.external_user_id,
        userId: row.user_id,
        meta: row.meta || {},
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async getLearningState(userId) {
      const result = await pool.query(
        `
          SELECT user_id, goal, content_focus, plan_preference, updated_at
          FROM learning_states
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        goal: row.goal || "",
        contentFocus: row.content_focus || "",
        planPreference: row.plan_preference || "",
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async upsertLearningState(userId, patch = {}) {
      const current = (await this.getLearningState(userId)) || {
        goal: "",
        contentFocus: "",
        planPreference: ""
      };
      const next = {
        goal: patch.goal ?? current.goal ?? "",
        contentFocus: patch.contentFocus ?? current.contentFocus ?? "",
        planPreference: patch.planPreference ?? current.planPreference ?? ""
      };
      const result = await pool.query(
        `
          INSERT INTO learning_states (user_id, goal, content_focus, plan_preference, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            goal = EXCLUDED.goal,
            content_focus = EXCLUDED.content_focus,
            plan_preference = EXCLUDED.plan_preference,
            updated_at = NOW()
          RETURNING user_id, goal, content_focus, plan_preference, updated_at
        `,
        [userId, next.goal, next.contentFocus, next.planPreference]
      );
      const row = result.rows[0];
      return {
        userId: row.user_id,
        goal: row.goal || "",
        contentFocus: row.content_focus || "",
        planPreference: row.plan_preference || "",
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async getDailyCheckin(userId, dateKey) {
      const result = await pool.query(
        `
          SELECT user_id, checkin_date, completed_task_ids, note, updated_at
          FROM daily_checkins
          WHERE user_id = $1 AND checkin_date = $2::date
          LIMIT 1
        `,
        [userId, dateKey]
      );

      const row = result.rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        dateKey: row.checkin_date?.toISOString?.().slice(0, 10) || String(row.checkin_date),
        completedTaskIds: row.completed_task_ids || [],
        note: row.note || "",
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    },
    async upsertDailyCheckin({ userId, dateKey, completedTaskIds = [], note = "" }) {
      const result = await pool.query(
        `
          INSERT INTO daily_checkins (user_id, checkin_date, completed_task_ids, note, updated_at)
          VALUES ($1, $2::date, $3::jsonb, $4, NOW())
          ON CONFLICT (user_id, checkin_date)
          DO UPDATE SET
            completed_task_ids = EXCLUDED.completed_task_ids,
            note = EXCLUDED.note,
            updated_at = NOW()
          RETURNING user_id, checkin_date, completed_task_ids, note, updated_at
        `,
        [userId, dateKey, JSON.stringify([...new Set(completedTaskIds)]), String(note || "")]
      );
      const row = result.rows[0];
      return {
        userId: row.user_id,
        dateKey: row.checkin_date?.toISOString?.().slice(0, 10) || String(row.checkin_date),
        completedTaskIds: row.completed_task_ids || [],
        note: row.note || "",
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at
      };
    }
  };
}

export async function createRepository() {
  if (config.usePostgres) {
    const repository = createPostgresRepository();
    await repository.init();
    return repository;
  }

  const repository = createMemoryRepository();
  await repository.init();
  return repository;
}
