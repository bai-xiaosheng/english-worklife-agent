const state = {
  token: localStorage.getItem("ewa_token") || "",
  user: null,
  profile: null,
  scenarios: [],
  sessionReady: false,
  lastAssistantMessage: "",
  recognition: null,
  listening: false
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
  progressStats: document.querySelector("#progressStats")
};

boot();

async function boot() {
  registerPWA();
  setupVoiceRecognition();
  bindEvents();
  await loadScenarios();
  await tryRestoreSession();
  appendBubble("assistant", "Welcome! Please login, then start your English practice.");
}

function bindEvents() {
  els.registerBtn.addEventListener("click", register);
  els.loginBtn.addEventListener("click", login);
  els.logoutBtn.addEventListener("click", logout);
  els.initBtn.addEventListener("click", initSession);
  els.sendBtn.addEventListener("click", sendMessage);
  els.voiceBtn.addEventListener("click", toggleVoiceInput);
  els.speakBtn.addEventListener("click", speakAssistantReply);
  els.messageInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      sendMessage();
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
    return;
  }

  try {
    const data = await request("/api/v1/auth/me");
    state.user = data.user;
    state.profile = data.profile;
    hydrateProfileForm();
    updateAuthStatus();
    await refreshProgress();
  } catch (_error) {
    clearAuth();
    updateAuthStatus();
  }
}

async function register() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  const displayName = els.displayNameInput.value.trim();
  const payload = {
    email,
    password,
    displayName,
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
  appendBubble("assistant", "Registration completed. Let's begin your first practice.");
}

async function login() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  const data = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true
  });

  afterAuthSuccess(data);
  appendBubble("assistant", "Login successful. Keep your daily 15-minute streak.");
}

function logout() {
  clearAuth();
  state.sessionReady = false;
  updateAuthStatus();
  els.progressStats.textContent = "请先登录并开始练习。";
  appendBubble("assistant", "You are logged out.");
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
  localStorage.removeItem("ewa_token");
}

function hydrateProfileForm() {
  if (!state.profile) return;
  els.levelSelect.value = state.profile.level || "A2";
  els.dailyMinutesInput.value = state.profile.dailyMinutes || 15;
}

function updateAuthStatus() {
  if (!state.user) {
    els.authStatus.textContent = "未登录";
    return;
  }

  const displayName = state.user.displayName ? ` (${state.user.displayName})` : "";
  els.authStatus.textContent = `已登录: ${state.user.email}${displayName}`;
}

function ensureAuthOrThrow() {
  if (!state.token) {
    throw new Error("请先登录后再开始练习。");
  }
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
  appendBubble("assistant", "Session ready. Start speaking English. I will coach you step by step.");
  await refreshProgress();
}

async function sendMessage() {
  const message = els.messageInput.value.trim();
  if (!message) return;

  ensureAuthOrThrow();
  if (!state.sessionReady) {
    await initSession();
  }

  appendBubble("user", message);
  els.messageInput.value = "";
  els.sendBtn.disabled = true;

  try {
    const response = await request("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: els.scenarioSelect.value,
        message,
        useChineseHint: els.chineseHintToggle.checked
      })
    });

    const roleplayReply = response?.assistant?.roleplayReply || "Let's continue. Please try another sentence.";
    state.lastAssistantMessage = roleplayReply;
    appendBubble("assistant", roleplayReply);

    const feedback = response.feedback || {};
    els.fluencyScore.textContent = `${feedback.fluencyScore ?? "-"}`;
    els.accuracyScore.textContent = `${feedback.accuracyScore ?? "-"}`;
    els.coachTip.textContent = feedback.coachTip || "-";
    els.rewriteBox.textContent = feedback.rewrite || "-";
    renderFixes(feedback.quickFixes || []);

    await refreshProgress();
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
    li.textContent = "Nice work. No major issue detected in this sentence.";
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
    `累计练习次数：<strong>${progress.totalPractices || 0}</strong>`,
    `平均流畅度：<strong>${progress.avgFluency || 0}</strong>`,
    `平均准确度：<strong>${progress.avgAccuracy || 0}</strong>`,
    `高频错误：<strong>${topErrors || "暂无"}</strong>`
  ].join("<br />");
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.voiceBtn.disabled = true;
    els.voiceBtn.textContent = "当前浏览器不支持语音输入";
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
    els.voiceBtn.textContent = "语音输入";
  };

  recognition.onerror = () => {
    state.listening = false;
    els.voiceBtn.classList.remove("voice-on");
    els.voiceBtn.textContent = "语音输入";
  };

  state.recognition = recognition;
}

function toggleVoiceInput() {
  if (!state.recognition) return;

  if (!state.listening) {
    state.listening = true;
    els.voiceBtn.classList.add("voice-on");
    els.voiceBtn.textContent = "正在听...点击停止";
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
    if (response.status === 401 && !options.skipAuth) {
      clearAuth();
      updateAuthStatus();
    }
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json();
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration errors for MVP.
    });
  }
}

