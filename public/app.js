const state = {
  token: localStorage.getItem("ewa_token") || "",
  user: null,
  profile: null,
  scenarios: [],
  sessionReady: false,
  lastAssistantMessage: "",
  recognition: null,
  listening: false,
  dailyDashboard: null,
  weeklyReport: null
};

const els = {
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  displayNameInput: document.querySelector("#displayNameInput"),
  registerBtn: document.querySelector("#registerBtn"),
  loginBtn: document.querySelector("#loginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  authStatus: document.querySelector("#authStatus"),
  levelSelect: document.querySelector("#levelSelect"),
  dailyMinutesInput: document.querySelector("#dailyMinutesInput"),
  scenarioSelect: document.querySelector("#scenarioSelect"),
  chineseHintToggle: document.querySelector("#chineseHintToggle"),
  initBtn: document.querySelector("#initBtn"),
  chatWindow: document.querySelector("#chatWindow"),
  messageInput: document.querySelector("#messageInput"),
  sendBtn: document.querySelector("#sendBtn"),
  voiceBtn: document.querySelector("#voiceBtn"),
  speakBtn: document.querySelector("#speakBtn"),
  fluencyScore: document.querySelector("#fluencyScore"),
  accuracyScore: document.querySelector("#accuracyScore"),
  coachTip: document.querySelector("#coachTip"),
  rewriteBox: document.querySelector("#rewriteBox"),
  fixList: document.querySelector("#fixList"),
  progressStats: document.querySelector("#progressStats"),
  dailyMeta: document.querySelector("#dailyMeta"),
  dailyTaskList: document.querySelector("#dailyTaskList"),
  dailyNoteInput: document.querySelector("#dailyNoteInput"),
  saveDailyBtn: document.querySelector("#saveDailyBtn"),
  refreshWeeklyBtn: document.querySelector("#refreshWeeklyBtn"),
  weeklySummary: document.querySelector("#weeklySummary"),
  weeklyStats: document.querySelector("#weeklyStats"),
  weeklyStrengthList: document.querySelector("#weeklyStrengthList"),
  weeklyRiskList: document.querySelector("#weeklyRiskList"),
  weeklyPlanList: document.querySelector("#weeklyPlanList")
};

boot();

async function boot() {
  registerPWA();
  setupVoiceRecognition();
  bindEvents();
  await loadScenarios();
  await tryRestoreSession();
  appendBubble("assistant", "Welcome. Login first, then follow your daily loop.");
}

function bindEvents() {
  els.registerBtn.addEventListener("click", () => register().catch((error) => showActionError(error)));
  els.loginBtn.addEventListener("click", () => login().catch((error) => showActionError(error)));
  els.logoutBtn.addEventListener("click", logout);
  els.initBtn.addEventListener("click", () => initSession().catch((error) => showActionError(error)));
  els.sendBtn.addEventListener("click", () => sendMessage().catch((error) => showActionError(error)));
  els.voiceBtn.addEventListener("click", toggleVoiceInput);
  els.speakBtn.addEventListener("click", speakAssistantReply);
  els.saveDailyBtn.addEventListener("click", () => saveDailyCheckin().catch((error) => showActionError(error)));
  els.refreshWeeklyBtn.addEventListener("click", () =>
    refreshWeeklyReport().catch((error) => showActionError(error))
  );
  els.messageInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      sendMessage().catch((error) => showActionError(error));
    }
  });
}

async function loadScenarios() {
  const data = await request("/api/v1/scenarios", { skipAuth: true });
  state.scenarios = data.scenarios || [];
  els.scenarioSelect.innerHTML = state.scenarios
    .map((scenario) => `<option value="${scenario.id}">${scenario.title}</option>`)
    .join("");
}

async function tryRestoreSession() {
  if (!state.token) {
    updateAuthStatus();
    renderDailyDashboard(null);
    return;
  }

  try {
    const data = await request("/api/v1/auth/me");
    state.user = data.user;
    state.profile = data.profile;
    hydrateProfileForm();
    updateAuthStatus();
    await refreshProgress();
    await refreshDailyDashboard();
    await refreshWeeklyReport();
  } catch (_error) {
    clearAuth();
    updateAuthStatus();
    renderDailyDashboard(null);
    renderWeeklyReport(null);
  }
}

async function register() {
  const payload = {
    email: els.emailInput.value.trim(),
    password: els.passwordInput.value,
    displayName: els.displayNameInput.value.trim(),
    profile: {
      level: els.levelSelect.value,
      dailyMinutes: Number(els.dailyMinutesInput.value || 15),
      preferredLocale: "zh-CN"
    }
  };

  const data = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true
  });

  afterAuthSuccess(data);
  await refreshProgress();
  await refreshDailyDashboard();
  await refreshWeeklyReport();
  appendBubble("assistant", "Registration complete. Start with warm-up voice task.");
}

async function login() {
  const data = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: els.emailInput.value.trim(),
      password: els.passwordInput.value
    }),
    skipAuth: true
  });

  afterAuthSuccess(data);
  await refreshProgress();
  await refreshDailyDashboard();
  await refreshWeeklyReport();
  appendBubble("assistant", "Login successful. Keep your streak alive today.");
}

function logout() {
  clearAuth();
  state.sessionReady = false;
  updateAuthStatus();
  els.progressStats.textContent = "Login to view your progress.";
  renderDailyDashboard(null);
  renderWeeklyReport(null);
  appendBubble("assistant", "Logged out.");
}

function afterAuthSuccess(data) {
  state.token = data.token;
  state.user = data.user;
  state.profile = data.profile || null;
  localStorage.setItem("ewa_token", state.token);
  hydrateProfileForm();
  updateAuthStatus();
}

function clearAuth() {
  state.token = "";
  state.user = null;
  state.profile = null;
  state.dailyDashboard = null;
  state.weeklyReport = null;
  localStorage.removeItem("ewa_token");
}

function hydrateProfileForm() {
  if (!state.profile) return;
  els.levelSelect.value = state.profile.level || "A2";
  els.dailyMinutesInput.value = state.profile.dailyMinutes || 15;
}

function updateAuthStatus() {
  if (!state.user) {
    els.authStatus.textContent = "Not logged in";
    return;
  }
  const displayName = state.user.displayName ? ` (${state.user.displayName})` : "";
  els.authStatus.textContent = `Logged in: ${state.user.email}${displayName}`;
}

function ensureAuthOrThrow() {
  if (!state.token) {
    throw new Error("Login first.");
  }
}

function showActionError(error) {
  const message = error?.message ? String(error.message) : "Unexpected error.";
  if (els.authStatus) {
    els.authStatus.textContent = `Action failed: ${message}`;
  }
  appendBubble("assistant", `Error: ${message}`);
}

async function initSession() {
  ensureAuthOrThrow();
  const payload = {
    profile: {
      level: els.levelSelect.value,
      dailyMinutes: Number(els.dailyMinutesInput.value || 15),
      preferredLocale: "zh-CN"
    }
  };

  const data = await request("/api/v1/session/init", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  state.profile = data.profile;
  state.sessionReady = true;
  appendBubble("assistant", "Session ready. Continue with your core scenario task.");
  await refreshProgress();
  await refreshDailyDashboard();
  await refreshWeeklyReport();
}

async function sendMessage() {
  const message = els.messageInput.value.trim();
  if (!message) return;

  els.sendBtn.disabled = true;

  try {
    ensureAuthOrThrow();
    if (!state.sessionReady) {
      await initSession();
    }

    appendBubble("user", message);
    els.messageInput.value = "";

    const response = await request("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: els.scenarioSelect.value,
        message,
        useChineseHint: els.chineseHintToggle.checked
      })
    });

    const roleplayReply = response?.assistant?.roleplayReply || "Let's continue. Try another sentence.";
    state.lastAssistantMessage = roleplayReply;
    appendBubble("assistant", roleplayReply);

    const feedback = response.feedback || {};
    els.fluencyScore.textContent = `${feedback.fluencyScore ?? "-"}`;
    els.accuracyScore.textContent = `${feedback.accuracyScore ?? "-"}`;
    els.coachTip.textContent = feedback.coachTip || "-";
    els.rewriteBox.textContent = feedback.rewrite || "-";
    renderFixes(feedback.quickFixes || []);

    if (response.dailyHint?.nextTask) {
      appendBubble("assistant", `Daily hint: ${response.dailyHint.nextTask}`);
    }

    await refreshProgress();
    await refreshDailyDashboard();
    await refreshWeeklyReport();
  } catch (error) {
    appendBubble("assistant", `Error: ${error.message}`);
  } finally {
    els.sendBtn.disabled = false;
  }
}

function appendBubble(role, text) {
  const node = document.createElement("div");
  node.className = `bubble ${role}`;
  node.textContent = text;
  els.chatWindow.appendChild(node);
  els.chatWindow.scrollTop = els.chatWindow.scrollHeight;
}

function renderFixes(fixes) {
  els.fixList.innerHTML = "";
  if (!fixes.length) {
    const li = document.createElement("li");
    li.textContent = "No major issue detected in this sentence.";
    els.fixList.appendChild(li);
    return;
  }

  for (const fix of fixes) {
    const li = document.createElement("li");
    li.textContent = `${fix.reason} Suggested: ${fix.suggestion}`;
    els.fixList.appendChild(li);
  }
}

async function refreshProgress() {
  ensureAuthOrThrow();
  const data = await request("/api/v1/progress/me");
  const progress = data.progress || {};
  const topErrors = (progress.topErrors || []).map((item) => `${item.tag}(${item.count})`).join(", ");
  els.progressStats.innerHTML = [
    `Total practices: <strong>${progress.totalPractices || 0}</strong>`,
    `Average fluency: <strong>${progress.avgFluency || 0}</strong>`,
    `Average accuracy: <strong>${progress.avgAccuracy || 0}</strong>`,
    `Top errors: <strong>${topErrors || "none"}</strong>`
  ].join("<br />");
}

async function refreshDailyDashboard() {
  ensureAuthOrThrow();
  const data = await request("/api/v1/daily/dashboard");
  state.dailyDashboard = data.dashboard || null;
  renderDailyDashboard(state.dailyDashboard);
}

function renderDailyDashboard(dashboard) {
  if (!dashboard) {
    els.dailyMeta.textContent = "Login to load your daily plan.";
    els.dailyTaskList.innerHTML = "";
    els.dailyNoteInput.value = "";
    return;
  }

  const weekly = dashboard.weekly || {};
  const plan = dashboard.plan || {};
  els.dailyMeta.textContent = `Date ${dashboard.todayKey} | Streak ${dashboard.streakDays} days | Active days(7d) ${
    weekly.activeDays || 0
  } | Focus ${dashboard.focusScenarioId}`;

  els.dailyTaskList.innerHTML = "";
  const tasks = plan.tasks || [];
  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = "daily-task-item";
    li.innerHTML = `
      <input type="checkbox" data-task-id="${task.id}" ${task.completed ? "checked" : ""} />
      <div>
        <strong>${task.title}</strong>
        <small>${task.tip}</small>
      </div>
    `;
    els.dailyTaskList.appendChild(li);
  }

  els.dailyNoteInput.value = plan.note || "";
}

async function refreshWeeklyReport() {
  ensureAuthOrThrow();
  const data = await request("/api/v1/weekly/report");
  state.weeklyReport = data.report || null;
  renderWeeklyReport(state.weeklyReport);
}

function renderWeeklyReport(report) {
  if (!report) {
    els.weeklySummary.textContent = "Login to generate weekly report.";
    els.weeklyStats.innerHTML = "";
    els.weeklyStrengthList.innerHTML = "";
    els.weeklyRiskList.innerHTML = "";
    els.weeklyPlanList.innerHTML = "";
    return;
  }

  const stats = report.stats || {};
  const trends = report.trends || {};
  els.weeklySummary.textContent = report.summary || "";
  els.weeklyStats.innerHTML = [
    `Week: <strong>${report.weekRange?.start || "-"} to ${report.weekRange?.end || "-"}</strong>`,
    `Practices: <strong>${stats.totalPractices || 0}</strong>`,
    `Active days: <strong>${stats.activeDays || 0}</strong>`,
    `Estimated minutes: <strong>${stats.estimatedMinutes || 0}</strong>`,
    `Fluency: <strong>${stats.avgFluency || 0}</strong> (${trends.fluency || "flat"})`,
    `Accuracy: <strong>${stats.avgAccuracy || 0}</strong> (${trends.accuracy || "flat"})`
  ].join("<br />");

  fillList(els.weeklyStrengthList, report.strengths || []);
  fillList(els.weeklyRiskList, report.risks || []);
  fillList(
    els.weeklyPlanList,
    (report.nextWeekPlan || []).map((item) => `${item.title}: ${item.action}`)
  );
}

async function saveDailyCheckin() {
  ensureAuthOrThrow();
  if (!state.dailyDashboard?.plan?.tasks?.length) return;

  const checkedIds = Array.from(els.dailyTaskList.querySelectorAll("input[type='checkbox']:checked")).map((input) =>
    input.getAttribute("data-task-id")
  );

  const data = await request("/api/v1/daily/checkin", {
    method: "POST",
    body: JSON.stringify({
      dateKey: state.dailyDashboard.todayKey,
      completedTaskIds: checkedIds,
      note: els.dailyNoteInput.value.trim()
    })
  });

  state.dailyDashboard = data.dashboard || state.dailyDashboard;
  renderDailyDashboard(state.dailyDashboard);
  await refreshWeeklyReport();
  appendBubble("assistant", "Daily check-in saved.");
}

function fillList(el, items) {
  el.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "-";
    el.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.voiceBtn.disabled = true;
    els.voiceBtn.textContent = "Voice input not supported";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    els.messageInput.value = transcript.trim();
  };

  recognition.onend = () => {
    state.listening = false;
    els.voiceBtn.classList.remove("voice-on");
    els.voiceBtn.textContent = "Voice input";
  };

  recognition.onerror = () => {
    state.listening = false;
    els.voiceBtn.classList.remove("voice-on");
    els.voiceBtn.textContent = "Voice input";
  };

  state.recognition = recognition;
}

function toggleVoiceInput() {
  if (!state.recognition) return;
  if (!state.listening) {
    state.listening = true;
    els.voiceBtn.classList.add("voice-on");
    els.voiceBtn.textContent = "Listening... click to stop";
    state.recognition.start();
    return;
  }
  state.recognition.stop();
}

function speakAssistantReply() {
  if (!state.lastAssistantMessage) return;
  if (!("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(state.lastAssistantMessage);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (!options.skipAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) {
        message = parsed.error;
      }
    } catch (_error) {
      // Keep original text message.
    }
    if (response.status === 401 && !options.skipAuth) {
      clearAuth();
      updateAuthStatus();
      renderDailyDashboard(null);
      renderWeeklyReport(null);
    }
    throw new Error(message);
  }

  return response.json();
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}
