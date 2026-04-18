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

function dateKeyToUtcDate(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function addDays(dateKey, days) {
  const dt = dateKeyToUtcDate(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function rangeDateKeys(startKey, endKey) {
  const keys = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function countActiveDays(records, rangeSet, timeZone) {
  const active = new Set();
  for (const record of records || []) {
    const key = formatDateKey(new Date(record.createdAt), timeZone);
    if (rangeSet.has(key)) active.add(key);
  }
  return active.size;
}

function average(records, field) {
  if (!records.length) return 0;
  const sum = records.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
  return Math.round(sum / records.length);
}

function summarizePeriod(records, startKey, endKey, timeZone) {
  const rangeSet = new Set(rangeDateKeys(startKey, endKey));
  const inRange = (records || []).filter((item) => {
    const key = formatDateKey(new Date(item.createdAt), timeZone);
    return rangeSet.has(key);
  });

  return {
    records: inRange,
    totalPractices: inRange.length,
    estimatedMinutes: inRange.length * 3,
    activeDays: countActiveDays(inRange, rangeSet, timeZone),
    avgFluency: average(inRange, "fluencyScore"),
    avgAccuracy: average(inRange, "accuracyScore")
  };
}

function trendLabel(current, previous) {
  if (current >= previous + 4) return "up";
  if (current <= previous - 4) return "down";
  return "flat";
}

function topScenario(records) {
  const freq = {};
  for (const item of records || []) {
    freq[item.scenarioId] = (freq[item.scenarioId] || 0) + 1;
  }
  const winner = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (!winner) return null;
  return {
    scenarioId: winner[0],
    count: winner[1]
  };
}

function buildStrengths({ currentSummary, topScenarioItem }) {
  const strengths = [];
  if (currentSummary.activeDays >= 5) {
    strengths.push("Consistency: practiced on at least 5 days this week.");
  } else if (currentSummary.activeDays >= 3) {
    strengths.push("Good momentum: practiced on at least 3 days this week.");
  }

  if (currentSummary.avgAccuracy >= 80) {
    strengths.push("Accuracy is strong this week.");
  }

  if (topScenarioItem) {
    strengths.push(`Most practiced scenario: ${topScenarioItem.scenarioId}.`);
  }

  if (!strengths.length) strengths.push("You kept the learning loop alive this week.");
  return strengths;
}

function buildRisks({ currentSummary, progress }) {
  const risks = [];
  if (currentSummary.activeDays <= 2) {
    risks.push("Practice frequency is low. Risk of losing speaking automaticity.");
  }

  if (currentSummary.avgFluency < 70 && currentSummary.totalPractices > 0) {
    risks.push("Fluency is still unstable. Responses may be too short or hesitant.");
  }

  const topErrorTag = progress?.topErrors?.[0]?.tag;
  if (topErrorTag) {
    risks.push(`Main recurring error: ${topErrorTag}.`);
  }

  if (!risks.length) risks.push("No major risk detected. Keep your current rhythm.");
  return risks;
}

function buildNextWeekPlan({ progress, profile, dailyDashboard }) {
  const targetMinutes = Number(profile?.dailyMinutes || 15);
  const focusScenarioId = dailyDashboard?.focusScenarioId || "team-standup";
  const topErrorTag = progress?.topErrors?.[0]?.tag || "expression-clarity";

  return [
    {
      title: "Keep the daily loop",
      action: `Do ${targetMinutes} minutes daily with checklist completion >= 80%.`
    },
    {
      title: "Scenario depth training",
      action: `Run ${focusScenarioId} for at least 3 sessions and increase reply length to 12+ words.`
    },
    {
      title: "Error repair",
      action: `Create 5 corrected sample sentences for "${topErrorTag}" and repeat them aloud every day.`
    }
  ];
}

export function buildWeeklyReport({ records, progress, profile, dailyDashboard, timeZone }) {
  const todayKey = formatDateKey(new Date(), timeZone);
  const weekEnd = todayKey;
  const weekStart = addDays(todayKey, -6);
  const prevWeekEnd = addDays(weekStart, -1);
  const prevWeekStart = addDays(prevWeekEnd, -6);

  const currentSummary = summarizePeriod(records, weekStart, weekEnd, timeZone);
  const previousSummary = summarizePeriod(records, prevWeekStart, prevWeekEnd, timeZone);

  const fluencyTrend = trendLabel(currentSummary.avgFluency, previousSummary.avgFluency);
  const accuracyTrend = trendLabel(currentSummary.avgAccuracy, previousSummary.avgAccuracy);
  const topScenarioItem = topScenario(currentSummary.records);

  return {
    weekRange: {
      start: weekStart,
      end: weekEnd
    },
    stats: {
      totalPractices: currentSummary.totalPractices,
      estimatedMinutes: currentSummary.estimatedMinutes,
      activeDays: currentSummary.activeDays,
      avgFluency: currentSummary.avgFluency,
      avgAccuracy: currentSummary.avgAccuracy
    },
    trends: {
      fluency: fluencyTrend,
      accuracy: accuracyTrend
    },
    strengths: buildStrengths({ currentSummary, topScenarioItem }),
    risks: buildRisks({ currentSummary, progress }),
    nextWeekPlan: buildNextWeekPlan({ progress, profile, dailyDashboard }),
    summary:
      currentSummary.totalPractices === 0
        ? "No practice this week yet. Restart with the daily loop today."
        : `You practiced ${currentSummary.totalPractices} times this week. Keep the streak and focus on one weak area.`
  };
}

