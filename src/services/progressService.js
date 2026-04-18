import { averageScore } from "../utils/score.js";

export async function recordPractice(repository, { userId, scenarioId, fluencyScore, accuracyScore, errorTags = [], source = "chat" }) {
  const record = {
    userId,
    scenarioId,
    fluencyScore,
    accuracyScore,
    errorTags,
    source,
    createdAt: new Date().toISOString()
  };

  return repository.addPracticeRecord(record);
}

function buildProgressSummary(userId, records) {
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

export async function getProgressSummary(repository, userId) {
  const records = await repository.getPracticeRecords(userId);
  return buildProgressSummary(userId, records);
}
