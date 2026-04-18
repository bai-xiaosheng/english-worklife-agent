function formatDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function minusDays(dateKey, days) {
  const dt = new Date(`${dateKey}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

function buildErrorToScenarioMap() {
  return {
    "subject-verb-agreement": "team-standup",
    "question-form": "renting-apartment",
    "native-language-mix": "small-talk-colleague",
    "short-utterance": "one-on-one-manager",
    punctuation: "doctor-visit",
    "word-order": "team-standup",
    "verb-form": "one-on-one-manager"
  };
}

function pickFocusScenario({ topErrors, records, scenarios }) {
  const allScenarioIds = new Set((scenarios || []).map((item) => item.id));
  const errorToScenario = buildErrorToScenarioMap();
  const topErrorTag = topErrors?.[0]?.tag || null;

  if (topErrorTag && errorToScenario[topErrorTag] && allScenarioIds.has(errorToScenario[topErrorTag])) {
    return {
      scenarioId: errorToScenario[topErrorTag],
      reason: `Weak area: ${topErrorTag}`
    };
  }

  const lastScenarioId = records?.length ? records[records.length - 1].scenarioId : null;
  if (lastScenarioId && allScenarioIds.has(lastScenarioId)) {
    return {
      scenarioId: lastScenarioId,
      reason: "Continue recent context to build speaking momentum"
    };
  }

  const firstScenario = scenarios?.[0]?.id || "team-standup";
  return {
    scenarioId: firstScenario,
    reason: "Default starter scenario"
  };
}

function calculateStreak(records, timeZone, todayKey) {
  const practicedDays = new Set((records || []).map((item) => formatDateKey(new Date(item.createdAt), timeZone)));
  let streak = 0;
  let cursor = todayKey;

  while (practicedDays.has(cursor)) {
    streak += 1;
    cursor = minusDays(cursor, 1);
  }

  return streak;
}

function summarizeLast7Days(records, timeZone, todayKey) {
  const byDay = {};
  const recentDays = [];
  for (let i = 6; i >= 0; i -= 1) {
    recentDays.push(minusDays(todayKey, i));
  }

  for (const key of recentDays) {
    byDay[key] = { records: 0, minutes: 0 };
  }

  for (const record of records || []) {
    const key = formatDateKey(new Date(record.createdAt), timeZone);
    if (!byDay[key]) continue;
    byDay[key].records += 1;
    byDay[key].minutes += 3;
  }

  const dayStats = recentDays.map((day) => ({
    day,
    practices: byDay[day].records,
    minutes: byDay[day].minutes
  }));

  const activeDays = dayStats.filter((item) => item.practices > 0).length;
  const totalMinutes = dayStats.reduce((acc, item) => acc + item.minutes, 0);
  return { dayStats, activeDays, totalMinutes };
}

function buildPlan({ todayKey, profile, focusScenarioId, topErrorTag, checkin }) {
  const dailyMinutes = Number(profile?.dailyMinutes || 15);
  const completedSet = new Set(checkin?.completedTaskIds || []);
  const tasks = [
    {
      id: "warmup-voice",
      title: "Warm-up voice (3 min)",
      minutes: 3,
      tip: "Speak 5 sentences about today's schedule in English."
    },
    {
      id: `core-scenario-${focusScenarioId}`,
      title: "Core scenario drill (8 min)",
      minutes: 8,
      tip: `Practice scenario: ${focusScenarioId}. Keep each response >= 10 words.`
    },
    {
      id: "repair-weakness",
      title: "Weakness repair (3 min)",
      minutes: 3,
      tip: topErrorTag
        ? `Repeat 3 corrected sentences for "${topErrorTag}".`
        : "Rewrite your last 3 replies into clearer English."
    },
    {
      id: "reflection-note",
      title: "Reflection note (1 min)",
      minutes: 1,
      tip: "Write one sentence: what improved today and what to fix tomorrow."
    }
  ].map((task) => ({
    ...task,
    completed: completedSet.has(task.id)
  }));

  const completedMinutes = tasks.filter((item) => item.completed).reduce((acc, item) => acc + item.minutes, 0);

  return {
    date: todayKey,
    targetMinutes: dailyMinutes,
    completedMinutes,
    completionRate: Math.min(100, Math.round((completedMinutes / Math.max(1, dailyMinutes)) * 100)),
    tasks,
    note: checkin?.note || ""
  };
}

export function getTodayKey(timeZone) {
  return formatDateKey(new Date(), timeZone);
}

export function buildDailyDashboard({ profile, progress, records, checkin, scenarios, timeZone }) {
  const todayKey = getTodayKey(timeZone);
  const streak = calculateStreak(records || [], timeZone, todayKey);
  const weekly = summarizeLast7Days(records || [], timeZone, todayKey);
  const focus = pickFocusScenario({
    topErrors: progress?.topErrors || [],
    records,
    scenarios
  });
  const topErrorTag = progress?.topErrors?.[0]?.tag || null;
  const plan = buildPlan({
    todayKey,
    profile,
    focusScenarioId: focus.scenarioId,
    topErrorTag,
    checkin
  });

  return {
    todayKey,
    streakDays: streak,
    focusScenarioId: focus.scenarioId,
    focusReason: focus.reason,
    topErrorTag,
    weekly,
    plan
  };
}

