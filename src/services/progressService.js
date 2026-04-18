import { getPracticeRecords, pushPracticeRecord } from "../data/inMemoryStore.js";
import { averageScore } from "../utils/score.js";

export function recordPractice({
  userId,
  scenarioId,
  fluencyScore,
  accuracyScore,
  errorTags = [],
  source = "chat"
}) {
  const record = {
    userId,
    scenarioId,
    fluencyScore,
    accuracyScore,
    errorTags,
    source,
    createdAt: new Date().toISOString()
  };

  pushPracticeRecord(userId, record);
  return record;
}

export function getProgressSummary(userId) {
  const records = getPracticeRecords(userId);
  const errorFreq = {};

  for (const record of records) {
    for (const tag of record.errorTags || []) {
      errorFreq[tag] = (errorFreq[tag] || 0) + 1;
    }
  }

  const topErrors = Object.entries(errorFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    userId,
    totalPractices: records.length,
    avgFluency: averageScore(records, "fluencyScore"),
    avgAccuracy: averageScore(records, "accuracyScore"),
    topErrors,
    recentRecords: records.slice(-10).reverse()
  };
}

