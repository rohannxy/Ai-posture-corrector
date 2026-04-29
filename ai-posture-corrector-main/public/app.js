/* ════════════════════════════════════════════════
   PostureAI — app.js
   Modules:
   1. Theme & Nav
   2. MediaPipe Pose Detection
   3. Posture Scoring Engine
   4. Feedback & Alerts
   5. Session Manager
   6. Analytics & Charts
   7. AI Consult
   8. Chatbot
   9. Setup Advisor
   10. Dashboard Updater
   ════════════════════════════════════════════════ */

"use strict";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = ""; // empty = same origin
const ALERT_THRESHOLD_SEC = 30;
const SESSION_STORAGE_KEY = "postureai_sessions";
const CHAT_STORAGE_KEY = "postureai_chat";
const THEME_STORAGE_KEY = "postureai_theme";
const SETUP_STORAGE_KEY = "postureai_setup";
const SAVED_ADVICE_KEY = "postureai_saved";
const TIPS = [
  "Sit with your back against the chair, hips at 90°. Your lumbar curve should feel supported.",
  "Every 30 minutes, roll your shoulders back 10 times to release tension.",
  "Keep your monitor at arm's length — about 50–70 cm from your eyes.",
  "Your chin should be parallel to the floor. Tucking it slightly prevents neck strain.",
  "Distribute your weight evenly on both feet while seated. Avoid crossing legs.",
  "Take micro-breaks every 20 minutes — stand, stretch for 30 seconds.",
  "Use the 20-20-20 rule: every 20 min, look 20 ft away for 20 seconds.",
  "Keep wrists straight and elbows close to body while typing.",
  "A standing desk for 1–2 hours per day can reduce back pain by up to 35%.",
  "Adjust your chair so your knees are at or slightly below hip level.",
  "Keep your phone at eye level to avoid 'text neck' — looking down adds 27kg of neck force.",
  "Core strengthening exercises 3x/week significantly improve sitting posture.",
];

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentTab: "dashboard",
  theme: "dark",
  camera: {
    running: false,
    stream: null,
    pose: null,
    camera: null,
    showSkeleton: true,
  },
  posture: {
    score: 0,
    neckAngle: 0,
    shoulderDiff: 0,
    backAlign: 0,
    status: "unknown",
    badStart: null,
    alertShown: false,
    scores: [],
    goodFrames: 0,
    totalFrames: 0,
  },
  session: {
    startTime: null,
    badDuration: 0,
    lastBadStart: null,
    avgScore: 0,
    scoreHistory: [],
  },
  ui: { tipIndex: 0 },
  charts: { weekly: null, daily: null, goodBad: null, dist: null },
};

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  // nav
  navTabs: document.querySelectorAll(".nav-tab"),
  mobTabs: document.querySelectorAll(".mob-tab"),
  hamburger: $("hamburger"),
  mobileNav: $("mobileNav"),
  themeToggle: $("themeToggle"),
  serverStatus: $("serverStatus"),
  // dashboard
  dashScore: $("dashScore"),
  dashStatus: $("dashStatus"),
  dashRingFill: $("dashRingFill"),
  statSession: $("statSession"),
  statBadTime: $("statBadTime"),
  statImprove: $("statImprove"),
  statStreak: $("statStreak"),
  dailyTip: $("dailyTip"),
  newTipBtn: $("newTipBtn"),
  barNeck: $("barNeck"), barNeckPct: $("barNeckPct"),
  barShoulders: $("barShoulders"), barShouldersPct: $("barShouldersPct"),
  barBack: $("barBack"), barBackPct: $("barBackPct"),
  weeklyReportBtn: $("weeklyReportBtn"),
  weeklyReportCard: $("weeklyReportCard"),
  weeklyReportBody: $("weeklyReportBody"),
  // camera
  webcamVideo: $("webcamVideo"),
  poseCanvas: $("poseCanvas"),
  camOverlay: $("camOverlay"),
  liveBadge: $("liveBadge"),
  scoreBadge: $("scoreBadge"),
  liveBadgeScore: $("liveBadgeScore"),
  startCamBtn: $("startCamBtn"),
  stopCamBtn: $("stopCamBtn"),
  toggleSkeletonBtn: $("toggleSkeletonBtn"),
  snapshotBtn: $("snapshotBtn"),
  postureAlert: $("postureAlert"),
  alertMsg: $("alertMsg"),
  liveScore: $("liveScore"),
  neckAngle: $("neckAngle"),
  shoulderBalance: $("shoulderBalance"),
  backAlign: $("backAlign"),
  liveStatus: $("liveStatus"),
  badTimer: $("badTimer"),
  suggestionList: $("suggestionList"),
  sessionDur: $("sessionDur"),
  sessionAvg: $("sessionAvg"),
  sessionGoodPct: $("sessionGoodPct"),
  // analytics
  historyTableBody: $("historyTableBody"),
  clearHistoryBtn: $("clearHistoryBtn"),
  analyticsSummary: $("analyticsSummary"),
  // setup
  userHeight: $("userHeight"),
  workHours: $("workHours"),
  deviceType: $("deviceType"),
  existingPain: $("existingPain"),
  getSetupBtn: $("getSetupBtn"),
  setupResult: $("setupResult"),
  setupSpinner: $("setupSpinner"),
  // ai consult
  aiConsultInput: $("aiConsultInput"),
  charCount: $("charCount"),
  aiConsultBtn: $("aiConsultBtn"),
  consultSpinner: $("consultSpinner"),
  aiResponseBody: $("aiResponseBody"),
  issueTag: $("issueTag"),
  responseActions: $("responseActions"),
  copyResponseBtn: $("copyResponseBtn"),
  saveResponseBtn: $("saveResponseBtn"),
  savedResponsesList: $("savedResponsesList"),
  clearSavedBtn: $("clearSavedBtn"),
  // chatbot
  chatFab: $("chatFab"),
  chatPanel: $("chatPanel"),
  fabBadge: $("fabBadge"),
  closeChatBtn: $("closeChatBtn"),
  clearChatBtn: $("clearChatBtn"),
  chatMessages: $("chatMessages"),
  chatInput: $("chatInput"),
  sendChatBtn: $("sendChatBtn"),
  // modal
  alertModal: $("alertModal"),
  modalMsg: $("modalMsg"),
  modalTips: $("modalTips"),
  // toast
  toastContainer: $("toastContainer"),
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. THEME & NAV
// ══════════════════════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  applyTheme(saved);
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  el.themeToggle.querySelector(".theme-icon").textContent = theme === "dark" ? "☀" : "◐";
}

function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById("tab-" + tabId)?.classList.add("active");

  el.navTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));
  el.mobTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));

  el.mobileNav.classList.remove("open");

  if (tabId === "analytics") refreshAnalytics();
  if (tabId === "dashboard") refreshDashboard();
}

// ── Server health check ───────────────────────────────────────────────────────
async function checkServer() {
  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      el.serverStatus.className = "status-dot online";
      el.serverStatus.title = "Server online";
    } else {
      el.serverStatus.className = "status-dot offline";
    }
  } catch {
    el.serverStatus.className = "status-dot offline";
    el.serverStatus.title = "Server offline";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. MEDIAPIPE POSE DETECTION
// ══════════════════════════════════════════════════════════════════════════════
async function startCamera() {
  try {
    el.startCamBtn.disabled = true;
    el.startCamBtn.textContent = "Starting...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    el.webcamVideo.srcObject = stream;
    state.camera.stream = stream;

    await new Promise((r) => (el.webcamVideo.onloadedmetadata = r));

    // Setup canvas
    el.poseCanvas.width = el.webcamVideo.videoWidth;
    el.poseCanvas.height = el.webcamVideo.videoHeight;

    // Init MediaPipe Pose
    const pose = new Pose({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults(onPoseResults);
    state.camera.pose = pose;

    // Camera loop
    const camera = new Camera(el.webcamVideo, {
      onFrame: async () => {
        await pose.send({ image: el.webcamVideo });
      },
      width: 640,
      height: 480,
    });
    camera.start();
    state.camera.camera = camera;
    state.camera.running = true;

    // UI updates
    el.camOverlay.style.display = "none";
    el.liveBadge.classList.remove("hidden");
    el.scoreBadge.classList.remove("hidden");
    el.startCamBtn.classList.add("hidden");
    el.stopCamBtn.classList.remove("hidden");

    // Start session
    startSession();
    showToast("Camera started. Analysing posture...", "success");
  } catch (err) {
    console.error("Camera error:", err);
    el.startCamBtn.disabled = false;
    el.startCamBtn.textContent = "▶ Start Camera";

    if (err.name === "NotAllowedError") {
      showToast("Camera permission denied. Please allow webcam access.", "error");
    } else {
      showToast("Camera error: " + err.message, "error");
    }
  }
}

function stopCamera() {
  if (state.camera.stream) {
    state.camera.stream.getTracks().forEach((t) => t.stop());
    state.camera.stream = null;
  }
  if (state.camera.camera) {
    state.camera.camera.stop?.();
    state.camera.camera = null;
  }
  state.camera.running = false;

  const ctx = el.poseCanvas.getContext("2d");
  ctx.clearRect(0, 0, el.poseCanvas.width, el.poseCanvas.height);

  el.camOverlay.style.display = "flex";
  el.liveBadge.classList.add("hidden");
  el.scoreBadge.classList.add("hidden");
  el.startCamBtn.classList.remove("hidden");
  el.startCamBtn.disabled = false;
  el.startCamBtn.textContent = "▶ Start Camera";
  el.stopCamBtn.classList.add("hidden");
  el.postureAlert.classList.add("hidden");

  endSession();
  showToast("Session ended and saved.", "success");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. POSTURE SCORING ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function onPoseResults(results) {
  const ctx = el.poseCanvas.getContext("2d");
  ctx.clearRect(0, 0, el.poseCanvas.width, el.poseCanvas.height);

  if (!results.poseLandmarks) {
    updateLiveUI(null);
    return;
  }

  const lm = results.poseLandmarks;

  // Draw skeleton
  if (state.camera.showSkeleton) {
    drawConnectors(ctx, lm, POSE_CONNECTIONS, { color: "rgba(0,229,160,0.5)", lineWidth: 2 });
    drawLandmarks(ctx, lm, { color: "rgba(0,229,160,0.9)", radius: 4, lineWidth: 1 });
  }

  // Extract key landmarks
  const nose = lm[0];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const leftHip = lm[23];
  const rightHip = lm[24];
  const leftEar = lm[7];
  const rightEar = lm[8];

  // Visibility check
  const visible = (p) => p && p.visibility > 0.3;
  if (!visible(nose) || !visible(leftShoulder) || !visible(rightShoulder)) {
    updateLiveUI(null);
    return;
  }

  // ── Neck angle (forward head posture) ─────────────────────────────────────
  // Angle between ear, shoulder midpoint, and vertical
  const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const earX = visible(leftEar) ? leftEar.x : rightEar.x;
  const earY = visible(leftEar) ? leftEar.y : rightEar.y;
  const neckAngle = Math.atan2(Math.abs(earX - midShoulderX), Math.abs(earY - midShoulderY)) * (180 / Math.PI);

  // ── Shoulder balance ───────────────────────────────────────────────────────
  const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y) * 100;

  // ── Back alignment (shoulder to hip angle) ────────────────────────────────
  const midHipX = (leftHip.x + rightHip.x) / 2;
  const midHipY = (leftHip.y + rightHip.y) / 2;
  const backAngle = Math.atan2(
    Math.abs(midShoulderX - midHipX),
    Math.abs(midShoulderY - midHipY)
  ) * (180 / Math.PI);

  // ── Score calculation ──────────────────────────────────────────────────────
  let neckScore = 100;
  if (neckAngle > 15) neckScore -= (neckAngle - 15) * 3;
  if (neckAngle > 30) neckScore -= (neckAngle - 30) * 2;
  neckScore = Math.max(0, Math.min(100, neckScore));

  let shoulderScore = 100;
  if (shoulderDiff > 3) shoulderScore -= (shoulderDiff - 3) * 10;
  shoulderScore = Math.max(0, Math.min(100, shoulderScore));

  let backScore = 100;
  if (backAngle > 10) backScore -= (backAngle - 10) * 4;
  backScore = Math.max(0, Math.min(100, backScore));

  const postureScore = Math.round(neckScore * 0.35 + shoulderScore * 0.30 + backScore * 0.35);

  state.posture.score = postureScore;
  state.posture.neckAngle = Math.round(neckAngle);
  state.posture.shoulderDiff = Math.round(shoulderDiff * 10) / 10;
  state.posture.backAlign = Math.round(backAngle);
  state.posture.neckScore = Math.round(neckScore);
  state.posture.shoulderScore = Math.round(shoulderScore);
  state.posture.backScore = Math.round(backScore);

  // Status
  if (postureScore >= 75) state.posture.status = "good";
  else if (postureScore >= 50) state.posture.status = "slight";
  else state.posture.status = "bad";

  state.posture.totalFrames++;
  if (state.posture.status === "good") state.posture.goodFrames++;

  // Track session scores
  state.session.scoreHistory.push(postureScore);
  if (state.session.scoreHistory.length > 300) state.session.scoreHistory.shift();

  // Bad posture timer
  trackBadPosture();

  updateLiveUI({
    postureScore, neckAngle, shoulderDiff, backAngle,
    neckScore, shoulderScore, backScore,
  });
}

function trackBadPosture() {
  const isBad = state.posture.status === "bad";

  if (isBad) {
    if (!state.posture.badStart) state.posture.badStart = Date.now();
    if (!state.session.lastBadStart) state.session.lastBadStart = Date.now();

    const badSec = (Date.now() - state.posture.badStart) / 1000;
    el.badTimer.textContent = Math.round(badSec) + "s";
    el.badTimer.style.color = "var(--danger)";

    if (badSec >= ALERT_THRESHOLD_SEC && !state.posture.alertShown) {
      state.posture.alertShown = true;
      showPostureModal();
    }
  } else {
    if (state.session.lastBadStart) {
      state.session.badDuration += (Date.now() - state.session.lastBadStart) / 1000;
      state.session.lastBadStart = null;
    }
    state.posture.badStart = null;
    state.posture.alertShown = false;
    el.badTimer.textContent = "0s";
    el.badTimer.style.color = "";
  }
}

function showPostureModal() {
  const suggestions = getSuggestions();
  el.modalMsg.textContent =
    `You've had bad posture for ${ALERT_THRESHOLD_SEC}+ seconds. Here's what to do:`;
  el.modalTips.innerHTML = suggestions.map((s) => `• ${s}`).join("<br/>");
  el.alertModal.classList.remove("hidden");
  // Play a small beep via oscillator
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

// ── Suggestions ───────────────────────────────────────────────────────────────
function getSuggestions() {
  const tips = [];
  const p = state.posture;

  if (p.neckAngle > 20) tips.push("Lift your chin — head is too far forward");
  if (p.neckAngle > 30) tips.push("Bring your ear over your shoulder, not in front");
  if (p.shoulderDiff > 5) tips.push("Level your shoulders — one is higher than the other");
  if (p.backAlign > 15) tips.push("Straighten your back — you're leaning to the side");
  if (p.score < 50) tips.push("Sit tall — imagine a string pulling you up from the crown of your head");
  if (tips.length === 0) tips.push("Good posture! Keep it up.");
  return tips;
}

function updateLiveUI(data) {
  if (!data) {
    el.liveScore.textContent = "—";
    el.neckAngle.textContent = "—°";
    el.shoulderBalance.textContent = "—";
    el.backAlign.textContent = "—";
    el.liveStatus.textContent = "No pose";
    el.liveBadgeScore.textContent = "—";
    return;
  }

  const { postureScore } = data;
  const status = state.posture.status;

  // Score display
  el.liveScore.textContent = postureScore;
  el.liveBadgeScore.textContent = postureScore;
  el.neckAngle.textContent = state.posture.neckAngle + "°";
  el.shoulderBalance.textContent = state.posture.shoulderDiff.toFixed(1) + "%";
  el.backAlign.textContent = state.posture.backAlign + "°";

  // Colors
  const color = status === "good" ? "good" : status === "slight" ? "warn" : "bad";
  el.liveScore.className = `metric-value ${color}`;
  el.liveStatus.className = `metric-value ${color}`;
  el.liveStatus.textContent = status === "good" ? "✓ Good" : status === "slight" ? "⚡ Slight" : "✗ Bad";

  // Alert bar
  if (status === "bad" && state.posture.badStart) {
    el.postureAlert.classList.remove("hidden");
    el.alertMsg.textContent = "Bad posture detected — " + getSuggestions()[0];
  } else {
    el.postureAlert.classList.add("hidden");
  }

  // Suggestions
  const sugs = getSuggestions();
  el.suggestionList.innerHTML = sugs
    .map((s) => `<li>${s}</li>`)
    .join("");

  // Session stats
  if (state.session.startTime) {
    const elapsed = Math.round((Date.now() - state.session.startTime) / 1000);
    el.sessionDur.textContent = formatDuration(elapsed);
    const avg = Math.round(state.session.scoreHistory.reduce((a, b) => a + b, 0) / (state.session.scoreHistory.length || 1));
    el.sessionAvg.textContent = avg;
    const goodPct = Math.round((state.posture.goodFrames / (state.posture.totalFrames || 1)) * 100);
    el.sessionGoodPct.textContent = goodPct + "%";
    el.sessionAvg.style.color = avg >= 75 ? "var(--good)" : avg >= 50 ? "var(--warn)" : "var(--danger)";
  }

  // Dashboard breakdown bars
  if (state.posture.neckScore !== undefined) {
    el.barNeck.style.width = state.posture.neckScore + "%";
    el.barNeckPct.textContent = state.posture.neckScore + "%";
    el.barShoulders.style.width = state.posture.shoulderScore + "%";
    el.barShouldersPct.textContent = state.posture.shoulderScore + "%";
    el.barBack.style.width = state.posture.backScore + "%";
    el.barBackPct.textContent = state.posture.backScore + "%";

    // Set bar colors
    [
      [el.barNeck, state.posture.neckScore],
      [el.barShoulders, state.posture.shoulderScore],
      [el.barBack, state.posture.backScore],
    ].forEach(([bar, score]) => {
      bar.style.background = score >= 75 ? "var(--good)" : score >= 50 ? "var(--warn)" : "var(--danger)";
    });
  }

  // Live dashboard score
  el.dashScore.textContent = postureScore;
  el.dashStatus.textContent =
    status === "good" ? "✓ Good Posture" : status === "slight" ? "⚡ Needs Attention" : "✗ Bad Posture";
  el.dashStatus.style.color =
    status === "good" ? "var(--good)" : status === "slight" ? "var(--warn)" : "var(--danger)";

  // Ring fill
  const circumference = 314;
  const offset = circumference - (postureScore / 100) * circumference;
  el.dashRingFill.style.strokeDashoffset = offset;
  el.dashRingFill.style.stroke =
    status === "good" ? "var(--good)" : status === "slight" ? "var(--warn)" : "var(--danger)";
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. SESSION MANAGER
// ══════════════════════════════════════════════════════════════════════════════
function startSession() {
  state.session.startTime = Date.now();
  state.session.scoreHistory = [];
  state.session.badDuration = 0;
  state.session.lastBadStart = null;
  state.posture.goodFrames = 0;
  state.posture.totalFrames = 0;
  state.posture.badStart = null;
  state.posture.alertShown = false;
}

function endSession() {
  if (!state.session.startTime) return;

  const duration = Math.round((Date.now() - state.session.startTime) / 1000);
  const scores = state.session.scoreHistory;
  if (scores.length === 0) return;

  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const badDuration = Math.round(state.session.badDuration);

  const sessions = getSessions();
  const today = new Date().toLocaleDateString("en-CA");
  const existing = sessions.find((s) => s.date === today);

  if (existing) {
    existing.duration = (existing.duration || 0) + duration;
    existing.badDuration = (existing.badDuration || 0) + badDuration;
    existing.avgScore = Math.round((existing.avgScore + avgScore) / 2);
  } else {
    sessions.push({ date: today, duration, badDuration, avgScore });
  }

  // Keep last 30 days
  while (sessions.length > 30) sessions.shift();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));

  state.session.startTime = null;
  refreshDashboard();
}

function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function refreshDashboard() {
  const sessions = getSessions();
  const today = new Date().toLocaleDateString("en-CA");
  const todayData = sessions.find((s) => s.date === today);

  if (todayData) {
    el.statSession.textContent = formatDuration(todayData.duration);
    el.statBadTime.textContent = formatDuration(todayData.badDuration);
  }

  // vs yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = yesterday.toLocaleDateString("en-CA");
  const yData = sessions.find((s) => s.date === yDate);
  if (todayData && yData) {
    const diff = todayData.avgScore - yData.avgScore;
    el.statImprove.textContent = (diff >= 0 ? "+" : "") + diff + "%";
    el.statImprove.style.color = diff >= 0 ? "var(--good)" : "var(--danger)";
  }

  // Streak
  let streak = 0;
  const sortedDates = sessions.map((s) => s.date).sort().reverse();
  for (let i = 0; i < sortedDates.length; i++) {
    const d = new Date(sortedDates[i]);
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    if (d.toLocaleDateString("en-CA") === expected.toLocaleDateString("en-CA")) streak++;
    else break;
  }
  el.statStreak.textContent = streak;

  // Weekly chart
  renderWeeklyChart(sessions);

  // Daily tip
  el.dailyTip.textContent = TIPS[state.ui.tipIndex % TIPS.length];
}

function renderWeeklyChart(sessions) {
  const canvas = document.getElementById("weeklyChart");
  const ctx = canvas.getContext("2d");
  const last7 = getLast7Days();
  const scores = last7.map((d) => {
    const s = sessions.find((x) => x.date === d);
    return s ? s.avgScore : null;
  });
  const labels = last7.map((d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  });

  if (state.charts.weekly) state.charts.weekly.destroy();
  state.charts.weekly = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Avg Score",
        data: scores,
        borderColor: "#00e5a0",
        backgroundColor: "rgba(0,229,160,0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#00e5a0",
        pointRadius: 5,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8a95a8", font: { family: "'Space Mono'" } },
        },
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8a95a8", font: { family: "'Space Mono'" } },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
function refreshAnalytics() {
  const sessions = getSessions();
  const last7 = getLast7Days();
  const last7Data = last7.map((d) => sessions.find((s) => s.date === d) || null);

  // History table
  const tbody = el.historyTableBody;
  if (sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No sessions recorded yet</td></tr>`;
  } else {
    tbody.innerHTML = [...sessions].reverse().map((s) => {
      const statusColor = s.avgScore >= 75 ? "var(--good)" : s.avgScore >= 50 ? "var(--warn)" : "var(--danger)";
      const statusText = s.avgScore >= 75 ? "Good" : s.avgScore >= 50 ? "Fair" : "Poor";
      return `<tr>
        <td>${s.date}</td>
        <td>${formatDuration(s.duration)}</td>
        <td style="color:${statusColor};font-family:var(--font-mono)">${s.avgScore}</td>
        <td>${formatDuration(s.badDuration)}</td>
        <td style="color:${statusColor}">${statusText}</td>
      </tr>`;
    }).join("");
  }

  // 7-day summary
  const validDays = last7Data.filter(Boolean);
  const totalAvg = validDays.length
    ? Math.round(validDays.reduce((a, b) => a + b.avgScore, 0) / validDays.length)
    : 0;
  const totalBad = validDays.reduce((a, b) => a + (b.badDuration || 0), 0);
  const totalTime = validDays.reduce((a, b) => a + (b.duration || 0), 0);

  el.analyticsSummary.innerHTML = `
    <div class="sum-row"><span>Days Tracked</span><span class="sum-val">${validDays.length}/7</span></div>
    <div class="sum-row"><span>7-Day Avg Score</span><span class="sum-val">${totalAvg}</span></div>
    <div class="sum-row"><span>Total Session Time</span><span class="sum-val">${formatDuration(totalTime)}</span></div>
    <div class="sum-row"><span>Total Bad Posture</span><span class="sum-val">${formatDuration(totalBad)}</span></div>
    <div class="sum-row"><span>Best Score</span><span class="sum-val">${validDays.length ? Math.max(...validDays.map((d) => d.avgScore)) : "—"}</span></div>
    <div class="sum-row"><span>Worst Score</span><span class="sum-val">${validDays.length ? Math.min(...validDays.map((d) => d.avgScore)) : "—"}</span></div>
  `;

  // Daily score chart
  renderAnalyticsCharts(last7, last7Data);
}

function renderAnalyticsCharts(labels7, data7) {
  const labelsShort = labels7.map((d) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { weekday: "short" });
  });

  const chartDefaults = {
    plugins: { legend: { display: false } },
    scales: {
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#8a95a8", font: { family: "'Space Mono'", size: 10 } },
      },
      x: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#8a95a8", font: { family: "'Space Mono'", size: 10 } },
      },
    },
    responsive: true,
  };

  // Daily score chart
  const dsCtx = document.getElementById("dailyScoreChart").getContext("2d");
  if (state.charts.daily) state.charts.daily.destroy();
  state.charts.daily = new Chart(dsCtx, {
    type: "bar",
    data: {
      labels: labelsShort,
      datasets: [{
        label: "Avg Score",
        data: data7.map((d) => d?.avgScore ?? null),
        backgroundColor: data7.map((d) =>
          !d ? "#1e2733" : d.avgScore >= 75 ? "rgba(0,229,160,0.7)" : d.avgScore >= 50 ? "rgba(255,184,0,0.7)" : "rgba(255,61,87,0.7)"
        ),
        borderRadius: 6,
        spanGaps: true,
      }],
    },
    options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 100 } } },
  });

  // Good vs Bad chart
  const gbCtx = document.getElementById("goodBadChart").getContext("2d");
  if (state.charts.goodBad) state.charts.goodBad.destroy();
  state.charts.goodBad = new Chart(gbCtx, {
    type: "bar",
    data: {
      labels: labelsShort,
      datasets: [
        {
          label: "Session (min)",
          data: data7.map((d) => d ? Math.round(d.duration / 60) : null),
          backgroundColor: "rgba(0,184,255,0.6)",
          borderRadius: 4,
        },
        {
          label: "Bad (min)",
          data: data7.map((d) => d ? Math.round(d.badDuration / 60) : null),
          backgroundColor: "rgba(255,61,87,0.6)",
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...chartDefaults,
      plugins: {
        legend: { display: true, labels: { color: "#8a95a8", font: { family: "'Space Mono'", size: 10 } } },
      },
    },
  });

  // Distribution chart (score ranges)
  const sessions = getSessions();
  const ranges = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
  sessions.forEach((s) => {
    const idx = Math.min(4, Math.floor(s.avgScore / 20));
    ranges[idx]++;
  });
  const distCtx = document.getElementById("distributionChart").getContext("2d");
  if (state.charts.dist) state.charts.dist.destroy();
  state.charts.dist = new Chart(distCtx, {
    type: "doughnut",
    data: {
      labels: ["0-20", "21-40", "41-60", "61-80", "81-100"],
      datasets: [{
        data: ranges,
        backgroundColor: ["#ff3d57", "#ff6b35", "#ffb800", "#00b8ff", "#00e5a0"],
        borderWidth: 2,
        borderColor: "var(--card)",
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { color: "#8a95a8", font: { family: "'Space Mono'", size: 10 } } },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. AI CONSULT
// ══════════════════════════════════════════════════════════════════════════════
async function submitAIConsult() {
  const text = el.aiConsultInput.value.trim();
  if (!text) { showToast("Please describe your issue first.", "warn"); return; }

  el.aiConsultBtn.disabled = true;
  el.aiConsultBtn.textContent = "Analysing...";
  el.consultSpinner.classList.remove("hidden");
  el.aiResponseBody.innerHTML = "";
  el.responseActions.classList.add("hidden");
  el.issueTag.classList.add("hidden");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Request failed");

    el.issueTag.textContent = data.issueLabel;
    el.issueTag.classList.remove("hidden");
    el.aiResponseBody.innerHTML = `<div class="formatted-response">${escapeHTML(data.reply)}</div>`;
    el.responseActions.classList.remove("hidden");

    // Store for copy/save
    el.copyResponseBtn._text = data.reply;
    el.saveResponseBtn._data = { query: text, reply: data.reply, label: data.issueLabel };
    showToast("AI advice ready!", "success");
  } catch (err) {
    el.aiResponseBody.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    showToast("Failed to get AI response.", "error");
  } finally {
    el.aiConsultBtn.disabled = false;
    el.aiConsultBtn.textContent = "🤖 Get AI Advice";
    el.consultSpinner.classList.add("hidden");
  }
}

function saveAdvice(data) {
  const saved = getSavedAdvice();
  saved.unshift({ ...data, savedAt: new Date().toLocaleString() });
  while (saved.length > 20) saved.pop();
  localStorage.setItem(SAVED_ADVICE_KEY, JSON.stringify(saved));
  renderSavedAdvice();
  showToast("Advice saved!", "success");
}

function getSavedAdvice() {
  try { return JSON.parse(localStorage.getItem(SAVED_ADVICE_KEY)) || []; }
  catch { return []; }
}

function renderSavedAdvice() {
  const saved = getSavedAdvice();
  if (saved.length === 0) {
    el.savedResponsesList.innerHTML = `<p class="empty-hint">No saved advice yet. Save responses to reference later.</p>`;
    return;
  }
  el.savedResponsesList.innerHTML = saved.map((s, i) => `
    <div class="saved-item">
      <div class="saved-item-header">
        <span class="saved-item-date">${s.savedAt} — ${s.label || "Advice"}</span>
        <button class="saved-delete" onclick="deleteSaved(${i})">✕</button>
      </div>
      <div class="saved-item-text"><strong>Q:</strong> ${escapeHTML(s.query)}</div>
      <div class="saved-item-text" style="margin-top:4px;white-space:pre-wrap;font-family:var(--font-mono);font-size:11px;color:var(--text2);">${escapeHTML(s.reply.slice(0, 300))}${s.reply.length > 300 ? "..." : ""}</div>
    </div>
  `).join("");
}

window.deleteSaved = function (i) {
  const saved = getSavedAdvice();
  saved.splice(i, 1);
  localStorage.setItem(SAVED_ADVICE_KEY, JSON.stringify(saved));
  renderSavedAdvice();
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. CHATBOT
// ══════════════════════════════════════════════════════════════════════════════
let chatHistory = [];

function initChat() {
  const saved = localStorage.getItem(CHAT_STORAGE_KEY);
  if (saved) {
    try {
      const msgs = JSON.parse(saved);
      chatHistory = msgs;
      msgs.forEach((m) => appendChatBubble(m.role, m.content, false));
      el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    } catch {}
  }
}

function appendChatBubble(role, text, save = true) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role === "user" ? "user" : "bot"}`;
  div.innerHTML = `
    ${role === "bot" ? '<span class="msg-avatar">⬡</span>' : ""}
    <div class="msg-bubble">${escapeHTML(text)}</div>
    ${role === "user" ? '<span class="msg-avatar" style="background:var(--bg2);border-color:var(--card-border);color:var(--text2)">👤</span>' : ""}
  `;
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;

  if (save) {
    chatHistory.push({ role, content: text });
    if (chatHistory.length > 20) chatHistory.shift();
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
  }
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "chat-msg bot";
  div.id = "typing-indicator";
  div.innerHTML = `
    <span class="msg-avatar">⬡</span>
    <div class="msg-bubble typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing-indicator")?.remove();
}

async function sendChatMessage(msg) {
  if (!msg.trim()) return;

  appendChatBubble("user", msg);
  el.chatInput.value = "";
  el.sendChatBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        context: state.posture.score ? `Current posture score: ${state.posture.score}` : undefined,
      }),
    });
    const data = await res.json();
    removeTyping();

    if (!res.ok) throw new Error(data.error);
    appendChatBubble("bot", data.reply);
  } catch (err) {
    removeTyping();
    appendChatBubble("bot", "Sorry, I couldn't reach the server. Please check your connection and try again.");
  } finally {
    el.sendChatBtn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. SETUP ADVISOR
// ══════════════════════════════════════════════════════════════════════════════
function loadSetupForm() {
  const saved = localStorage.getItem(SETUP_STORAGE_KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      el.userHeight.value = d.height || "";
      el.workHours.value = d.workHours || "";
      el.deviceType.value = d.deviceType || "laptop";
      el.existingPain.value = d.existingPain || "";
    } catch {}
  }
}

async function getSetupAdvice() {
  const height = el.userHeight.value;
  const workHours = el.workHours.value;
  const deviceType = el.deviceType.value;
  const existingPain = el.existingPain.value;

  if (!height || !workHours) {
    showToast("Please enter your height and work hours.", "warn");
    return;
  }

  localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify({ height, workHours, deviceType, existingPain }));

  el.getSetupBtn.disabled = true;
  el.getSetupBtn.textContent = "Generating...";
  el.setupSpinner.classList.remove("hidden");
  el.setupResult.innerHTML = "";

  try {
    const res = await fetch("/api/setup-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ height, workHours, deviceType, existingPain }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    el.setupResult.innerHTML = `<div class="formatted-response">${escapeHTML(data.advice)}</div>`;
    showToast("Setup advice generated!", "success");
  } catch (err) {
    el.setupResult.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  } finally {
    el.getSetupBtn.disabled = false;
    el.getSetupBtn.textContent = "🤖 Get AI Recommendations";
    el.setupSpinner.classList.add("hidden");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. WEEKLY AI REPORT
// ══════════════════════════════════════════════════════════════════════════════
async function generateWeeklyReport() {
  const sessions = getSessions();
  const last7 = getLast7Days();
  const weekData = last7.map((d) => sessions.find((s) => s.date === d) || { date: d, noData: true });

  el.weeklyReportBtn.disabled = true;
  el.weeklyReportBtn.textContent = "Generating...";
  el.weeklyReportCard.classList.remove("hidden");
  el.weeklyReportBody.textContent = "Generating your AI weekly report...";

  try {
    const res = await fetch("/api/weekly-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    el.weeklyReportBody.textContent = data.report;
    showToast("Weekly report ready!", "success");
  } catch (err) {
    el.weeklyReportBody.textContent = "Error: " + err.message;
  } finally {
    el.weeklyReportBtn.disabled = false;
    el.weeklyReportBtn.textContent = "🤖 Generate AI Report";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function formatDuration(seconds) {
  if (!seconds || seconds < 1) return "0s";
  if (seconds < 60) return Math.round(seconds) + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-CA"));
  }
  return days;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  el.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════════════════
function bindEvents() {
  // Theme
  el.themeToggle.addEventListener("click", toggleTheme);

  // Nav tabs
  el.navTabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  el.mobTabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  el.hamburger.addEventListener("click", () => el.mobileNav.classList.toggle("open"));

  // Camera
  el.startCamBtn.addEventListener("click", startCamera);
  el.stopCamBtn.addEventListener("click", stopCamera);
  el.toggleSkeletonBtn.addEventListener("click", () => {
    state.camera.showSkeleton = !state.camera.showSkeleton;
    el.toggleSkeletonBtn.textContent = `🦴 Skeleton ${state.camera.showSkeleton ? "ON" : "OFF"}`;
  });
  el.snapshotBtn.addEventListener("click", takeSnapshot);

  // Weekly report
  el.weeklyReportBtn.addEventListener("click", generateWeeklyReport);

  // Tip rotation
  el.newTipBtn.addEventListener("click", () => {
    state.ui.tipIndex = (state.ui.tipIndex + 1) % TIPS.length;
    el.dailyTip.textContent = TIPS[state.ui.tipIndex];
  });

  // Clear history
  el.clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Clear all session history? This cannot be undone.")) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      refreshAnalytics();
      refreshDashboard();
      showToast("History cleared.", "warn");
    }
  });

  // Setup
  el.getSetupBtn.addEventListener("click", getSetupAdvice);

  // AI Consult
  el.aiConsultBtn.addEventListener("click", submitAIConsult);
  el.aiConsultInput.addEventListener("input", () => {
    const len = el.aiConsultInput.value.length;
    el.charCount.textContent = `${len} / 500`;
    if (len > 500) el.aiConsultInput.value = el.aiConsultInput.value.slice(0, 500);
  });
  el.aiConsultInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) submitAIConsult();
  });

  document.querySelectorAll(".quick-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.aiConsultInput.value = btn.dataset.prompt;
      el.charCount.textContent = btn.dataset.prompt.length + " / 500";
    });
  });

  el.copyResponseBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(el.copyResponseBtn._text || "").then(() => showToast("Copied!", "success"));
  });
  el.saveResponseBtn.addEventListener("click", () => {
    if (el.saveResponseBtn._data) saveAdvice(el.saveResponseBtn._data);
  });
  el.clearSavedBtn.addEventListener("click", () => {
    localStorage.removeItem(SAVED_ADVICE_KEY);
    renderSavedAdvice();
    showToast("Saved advice cleared.", "warn");
  });

  // Chatbot
  el.chatFab.addEventListener("click", () => {
    el.chatPanel.classList.toggle("hidden");
    el.fabBadge.classList.add("hidden");
  });
  el.closeChatBtn.addEventListener("click", () => el.chatPanel.classList.add("hidden"));
  el.clearChatBtn.addEventListener("click", () => {
    chatHistory = [];
    localStorage.removeItem(CHAT_STORAGE_KEY);
    el.chatMessages.innerHTML = `
      <div class="chat-msg bot">
        <span class="msg-avatar">⬡</span>
        <div class="msg-bubble">Chat cleared! How can I help you with your posture?</div>
      </div>
    `;
  });

  el.sendChatBtn.addEventListener("click", () => sendChatMessage(el.chatInput.value));
  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage(el.chatInput.value);
  });

  document.querySelectorAll(".qchat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.chatPanel.classList.remove("hidden");
      sendChatMessage(btn.dataset.msg);
    });
  });

  // Modal close on overlay click
  el.alertModal.addEventListener("click", (e) => {
    if (e.target === el.alertModal) el.alertModal.classList.add("hidden");
  });
}

// ── Snapshot ──────────────────────────────────────────────────────────────────
function takeSnapshot() {
  if (!state.camera.running) { showToast("Start camera first.", "warn"); return; }
  const merged = document.createElement("canvas");
  merged.width = el.poseCanvas.width;
  merged.height = el.poseCanvas.height;
  const ctx = merged.getContext("2d");
  ctx.drawImage(el.webcamVideo, 0, 0);
  ctx.drawImage(el.poseCanvas, 0, 0);
  // Score overlay
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(10, 10, 180, 60);
  ctx.fillStyle = "#00e5a0";
  ctx.font = "bold 28px monospace";
  ctx.fillText(`Score: ${state.posture.score}`, 20, 50);

  const link = document.createElement("a");
  link.download = `posture-${Date.now()}.png`;
  link.href = merged.toDataURL("image/png");
  link.click();
  showToast("Snapshot saved!", "success");
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
function init() {
  initTheme();
  bindEvents();
  loadSetupForm();
  renderSavedAdvice();
  refreshDashboard();
  initChat();
  checkServer();

  // Periodic server check
  setInterval(checkServer, 30000);

  // Show floating badge after 3s if chat panel is hidden
  setTimeout(() => {
    if (el.chatPanel.classList.contains("hidden")) {
      el.fabBadge.classList.remove("hidden");
    }
  }, 3000);

  // Tip randomise
  state.ui.tipIndex = Math.floor(Math.random() * TIPS.length);
  el.dailyTip.textContent = TIPS[state.ui.tipIndex];

  // Update session stats every second while camera is running
  setInterval(() => {
    if (state.session.startTime) {
      const elapsed = Math.round((Date.now() - state.session.startTime) / 1000);
      el.sessionDur.textContent = formatDuration(elapsed);
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", init);