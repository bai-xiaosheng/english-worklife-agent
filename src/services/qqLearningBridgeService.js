function clean(text) {
  return String(text || "").trim();
}

function normalize(text) {
  return clean(text).replace(/\s+/g, " ");
}

function lower(text) {
  return normalize(text).toLowerCase();
}

function matchExact(input, options) {
  return options.includes(lower(input));
}

function readByPrefixes(input, prefixes) {
  const text = normalize(input);
  const textLower = text.toLowerCase();
  for (const prefix of prefixes) {
    if (textLower.startsWith(prefix.toLowerCase())) {
      return text.slice(prefix.length).trim();
    }
  }
  return "";
}

function parseCheckinPayload(raw) {
  const text = clean(raw);
  if (!text) {
    return { completedTaskIds: [], note: "" };
  }

  const [taskPart, notePart = ""] = text.split("|");
  const completedTaskIds = taskPart
    .split(/[,\uff0c;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    completedTaskIds,
    note: notePart.trim()
  };
}

function parseReviewPayload(raw) {
  const text = clean(raw);
  if (!text) {
    return {
      wins: "",
      blocker: "",
      nextAction: ""
    };
  }

  const [wins = "", blocker = "", nextAction = ""] = text.split("|");
  return {
    wins: wins.trim(),
    blocker: blocker.trim(),
    nextAction: nextAction.trim()
  };
}

export function parseLearningCommand(inputText) {
  const text = normalize(inputText);
  if (!text) {
    return { type: "empty" };
  }

  if (
    matchExact(text, [
      "/help",
      "/learn help",
      "help",
      "学习帮助",
      "帮助",
      "命令",
      "指令"
    ])
  ) {
    return { type: "help" };
  }

  const goalPayload = readByPrefixes(text, ["/learn goal ", "/goal ", "学习目标 ", "目标 "]);
  if (goalPayload) {
    return {
      type: "goal",
      payload: goalPayload
    };
  }

  const contentPayload = readByPrefixes(text, ["/learn content ", "/learn focus ", "学习内容 ", "内容重点 "]);
  if (contentPayload) {
    return {
      type: "content",
      payload: contentPayload
    };
  }

  const preferencePayload = readByPrefixes(text, [
    "/learn preference ",
    "/learn style ",
    "计划偏好 ",
    "学习计划偏好 "
  ]);
  if (preferencePayload) {
    return {
      type: "preference",
      payload: preferencePayload
    };
  }

  if (
    matchExact(text, [
      "/learn plan",
      "/plan",
      "学习计划",
      "今日计划",
      "今天学什么",
      "今日学习"
    ])
  ) {
    return { type: "plan" };
  }

  if (
    matchExact(text, [
      "/learn week",
      "/learn weekly",
      "/week",
      "周复盘",
      "本周复盘",
      "weekly review"
    ])
  ) {
    return { type: "weekly" };
  }

  if (
    matchExact(text, [
      "/learn status",
      "/status",
      "学习状态",
      "学习进度",
      "进度"
    ])
  ) {
    return { type: "status" };
  }

  if (
    lower(text).startsWith("/learn checkin") ||
    lower(text).startsWith("/checkin") ||
    text.startsWith("打卡") ||
    text.startsWith("学习打卡")
  ) {
    const payloadText =
      readByPrefixes(text, ["/learn checkin ", "/checkin ", "学习打卡 ", "打卡 "]) ||
      readByPrefixes(text, ["/learn checkin", "/checkin", "学习打卡", "打卡"]);
    return {
      type: "checkin",
      payload: parseCheckinPayload(payloadText)
    };
  }

  if (
    lower(text).startsWith("/learn review") ||
    lower(text).startsWith("/review") ||
    text.startsWith("复盘")
  ) {
    const payloadText =
      readByPrefixes(text, ["/learn review ", "/review ", "复盘 "]) ||
      readByPrefixes(text, ["/learn review", "/review", "复盘"]);
    return {
      type: "review",
      payload: parseReviewPayload(payloadText)
    };
  }

  if (
    matchExact(text, [
      "/learn improve",
      "/improve",
      "改进建议",
      "下一步改进",
      "学习改进"
    ])
  ) {
    return { type: "improve" };
  }

  const practicePayload = readByPrefixes(text, ["/learn do ", "/do ", "练习 ", "学习执行 "]);
  if (practicePayload) {
    return {
      type: "practice",
      payload: practicePayload
    };
  }

  return {
    type: "practice",
    payload: text
  };
}

export function buildHelpMessage() {
  return [
    "English Learning Bot Commands (also supports Chinese aliases):",
    "/learn goal <text> | 学习目标 <目标>",
    "/learn content <focus> | 学习内容 <重点>",
    "/learn preference <style> | 计划偏好 <偏好>",
    "/learn plan | 今日计划",
    "/learn do <english sentence> | 练习 <英文句子>",
    "/learn checkin task1,task2|note | 打卡 task1,task2|备注",
    "/learn review win|blocker|nextAction | 复盘 收获|阻碍|下一步",
    "/learn week | 周复盘",
    "/learn status | 学习状态",
    "/learn improve | 改进建议",
    "Tip: if you just send an English sentence, I treat it as practice."
  ].join("\n");
}

export function formatGoalMessage(learningState) {
  return [
    "Goal updated.",
    `Current goal: ${learningState.goal || "(not set)"}`,
    `Content focus: ${learningState.contentFocus || "(not set)"}`,
    `Plan preference: ${learningState.planPreference || "(not set)"}`,
    "Next: run /learn plan and complete today's loop."
  ].join("\n");
}

export function formatLearningStateMessage(learningState) {
  return [
    "Learning state updated.",
    `Goal: ${learningState.goal || "(not set)"}`,
    `Content focus: ${learningState.contentFocus || "(not set)"}`,
    `Plan preference: ${learningState.planPreference || "(not set)"}`,
    "Next: run /learn plan."
  ].join("\n");
}

export function formatPlanMessage({ dashboard, learningState }) {
  const tasks = (dashboard?.plan?.tasks || []).map((task) => {
    const mark = task.completed ? "[x]" : "[ ]";
    return `${mark} ${task.id} - ${task.title}`;
  });

  return [
    `Goal: ${learningState?.goal || "(not set)"}`,
    `Content focus: ${learningState?.contentFocus || "(not set)"}`,
    `Plan preference: ${learningState?.planPreference || "(not set)"}`,
    `Today ${dashboard?.todayKey || "-"} | Streak ${dashboard?.streakDays || 0} days`,
    `Focus scenario: ${dashboard?.focusScenarioId || "-"}`,
    `Top issue: ${dashboard?.topErrorTag || "none"}`,
    "Tasks:",
    ...tasks
  ].join("\n");
}

export function formatStatusMessage({ progress, learningState, dashboard }) {
  return [
    `Goal: ${learningState?.goal || "(not set)"}`,
    `Content focus: ${learningState?.contentFocus || "(not set)"}`,
    `Plan preference: ${learningState?.planPreference || "(not set)"}`,
    `Total practices: ${progress?.totalPractices || 0}`,
    `Fluency avg: ${progress?.avgFluency || 0}`,
    `Accuracy avg: ${progress?.avgAccuracy || 0}`,
    `Top errors: ${(progress?.topErrors || []).map((item) => `${item.tag}(${item.count})`).join(", ") || "none"}`,
    `Today completion: ${dashboard?.plan?.completionRate || 0}%`
  ].join("\n");
}

export function formatCheckinMessage({ checkin, dashboard }) {
  return [
    "Check-in saved.",
    `Date: ${checkin?.dateKey || dashboard?.todayKey || "-"}`,
    `Completed tasks: ${(checkin?.completedTaskIds || []).join(", ") || "none"}`,
    `Daily completion: ${dashboard?.plan?.completionRate || 0}%`,
    "If you have blockers, send /learn review <win>|<blocker>|<next action>."
  ].join("\n");
}

export function formatWeeklyMessage(report) {
  const planLines = (report?.nextWeekPlan || []).map((item, index) => `${index + 1}. ${item.title} -> ${item.action}`);
  return [
    `Week: ${report?.weekRange?.start || "-"} to ${report?.weekRange?.end || "-"}`,
    `Practices: ${report?.stats?.totalPractices || 0}, Active days: ${report?.stats?.activeDays || 0}`,
    `Fluency: ${report?.stats?.avgFluency || 0} (${report?.trends?.fluency || "flat"})`,
    `Accuracy: ${report?.stats?.avgAccuracy || 0} (${report?.trends?.accuracy || "flat"})`,
    `Summary: ${report?.summary || "-"}`,
    "Next week plan:",
    ...planLines
  ].join("\n");
}

export function formatReviewMessage({ review, dashboard }) {
  return [
    "Daily review saved.",
    `Wins: ${review?.wins || "-"}`,
    `Blocker: ${review?.blocker || "-"}`,
    `Next action: ${review?.nextAction || "-"}`,
    `Today's completion: ${dashboard?.plan?.completionRate || 0}%`
  ].join("\n");
}

export function formatImproveMessage({ progress, dashboard, weeklyReport, learningState }) {
  const topError = progress?.topErrors?.[0];
  const nextPlan = (weeklyReport?.nextWeekPlan || []).slice(0, 2);
  const lines = nextPlan.map((item, index) => `${index + 1}. ${item.title}: ${item.action}`);
  return [
    "Improvement suggestions:",
    `Goal: ${learningState?.goal || "(not set)"}`,
    `Priority error: ${topError ? `${topError.tag} (${topError.count})` : "none"}`,
    `Today's focus: ${dashboard?.focusScenarioId || "-"}`,
    ...lines,
    "Action now: send one new English sentence for focused correction."
  ].join("\n");
}

export function formatPracticeMessage({ assistant, feedback, dailyHint }) {
  const fix = (feedback?.quickFixes || [])[0];
  const fixLine = fix ? `Fix: ${fix.suggestion}` : "Fix: no major issue";
  return [
    assistant?.roleplayReply || "Let's continue practice.",
    `Scores -> Fluency ${feedback?.fluencyScore || 0}, Accuracy ${feedback?.accuracyScore || 0}`,
    fixLine,
    `Coach: ${feedback?.coachTip || "-"}`,
    `Next task: ${dailyHint?.nextTask || "Continue daily loop"}`
  ].join("\n");
}
