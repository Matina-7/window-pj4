// main.js - WINDOW / Anti-Surveillance Gaze System v2
// 包含：平滑+吸附的眼动追踪 / 监控窗口对注视的反应 / 反向幽灵闪现 / 稳定度评分

/* =============== 0. DOM references =============== */
const scenes = {
  loading: document.getElementById("scene-loading"),
  wall: document.getElementById("scene-wall"),
  logs: document.getElementById("scene-logs"),
  report: document.getElementById("scene-report"),
};

const btnStart = document.getElementById("btn-start");
const btnToLogs = document.getElementById("btn-to-logs");
const btnToReport = document.getElementById("btn-to-report");
const btnRestart = document.getElementById("btn-restart");

const loadingTextEl = document.getElementById("loading-text");
const wallGrid = document.getElementById("wall-grid");
const labelViewer = document.getElementById("label-viewer");
const scoreVoyeur = document.getElementById("score-voyeur");
const logLines = document.getElementById("log-lines");
const reportTextEl = document.getElementById("report-text");

const gazeDot = document.getElementById("gaze-dot");
const gazeDotLogs = document.getElementById("gaze-dot-logs");

const calibrationOverlay = document.getElementById("calibration-overlay");
const btnCalibStart = document.getElementById("btn-calib-start");

/* =============== 1. Global state =============== */
const state = {
  currentScene: "loading",
  wallWindows: [], // {el, innerEl, type, fixationTime, gazeHold, reactStage}
  voyeurScore: 0,
  gazeEnabled: false,
  gazePosition: { x: 0, y: 0 }, // 逻辑使用的平滑坐标
  gazePositionPrev: null,
  gazeHistory: [],
  gazeSmoothingWindow: [], // 平滑窗口
  lastRawGaze: null, // 原始 gaze（用于眨眼过滤）
  displayDotPos: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }, // 红点实际显示位置
  lastFocusedWindow: null,
  windowRects: [], // 用于区域吸附 [{el, rect}]
  stabilitySamples: [], // 最近若干帧的抖动值
  stabilityStars: "★★★☆☆",
};

const WINDOW_TYPES = [
  "BEDROOM",
  "OFFICE",
  "CORRIDOR",
  "ELEVATOR",
  "LOBBY",
  "KITCHEN",
];

/* =============== 2. Helpers =============== */

// 更新所有监控窗口的 rect，用于区域吸附
function updateWindowRects() {
  state.windowRects = state.wallWindows.map((w) => ({
    el: w.el,
    rect: w.el.getBoundingClientRect(),
  }));
}

// 区域吸附：接近某个窗口中心就吸过去（提升灵敏度）
function snapToRegion(x, y, threshold = 140) {
  if (!state.windowRects || state.windowRects.length === 0) {
    return { x, y, snapped: false };
  }
  let best = null;
  let bestDist = Infinity;

  for (const w of state.windowRects) {
    const cx = w.rect.left + w.rect.width / 2;
    const cy = w.rect.top + w.rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { x: cx, y: cy };
    }
  }
  if (best && bestDist < threshold) {
    return { x: best.x, y: best.y, snapped: true };
  }
  return { x, y, snapped: false };
}

// 简单的 HUD：显示眼动稳定度
let stabilityHudEl = null;
function createEyeStabilityHud() {
  stabilityHudEl = document.createElement("div");
  stabilityHudEl.id = "eye-stability-hud";
  stabilityHudEl.style.position = "fixed";
  stabilityHudEl.style.right = "18px";
  stabilityHudEl.style.bottom = "14px";
  stabilityHudEl.style.padding = "6px 10px";
  stabilityHudEl.style.fontFamily = "monospace";
  stabilityHudEl.style.fontSize = "11px";
  stabilityHudEl.style.letterSpacing = "0.08em";
  stabilityHudEl.style.color = "#a8b4ff";
  stabilityHudEl.style.background = "rgba(5, 7, 12, 0.85)";
  stabilityHudEl.style.border = "1px solid rgba(120,130,255,0.35)";
  stabilityHudEl.style.borderRadius = "6px";
  stabilityHudEl.style.zIndex = "9999";
  stabilityHudEl.style.pointerEvents = "none";
  stabilityHudEl.textContent = "EYE STABILITY: ★★★☆☆";
  document.body.appendChild(stabilityHudEl);
}

function updateEyeStabilityHud() {
  if (!stabilityHudEl) return;
  if (state.stabilitySamples.length < 5) return;

  // 平均抖动距离
  const avgJitter =
    state.stabilitySamples.reduce((s, v) => s + v, 0) /
    state.stabilitySamples.length;

  let stars;
  if (avgJitter < 15) stars = "★★★★★";
  else if (avgJitter < 30) stars = "★★★★☆";
  else if (avgJitter < 55) stars = "★★★☆☆";
  else if (avgJitter < 90) stars = "★★☆☆☆";
  else stars = "★☆☆☆☆";

  state.stabilityStars = stars;
  stabilityHudEl.textContent = `EYE STABILITY: ${stars}`;
}

// 为窗口反应注入一点样式（柔光 + 幽灵闪现）
function injectWindowEffectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .cam-window-inner {
      position: relative;
      overflow: hidden;
    }
    .cam-window-inner.cam-react-soft {
      box-shadow: 0 0 18px rgba(255, 80, 120, 0.35);
      filter: grayscale(0.2) contrast(1.15);
    }
    .cam-window-inner.cam-react-strong {
      box-shadow: 0 0 26px rgba(255, 120, 160, 0.55);
      transform: scale(1.02);
      filter: grayscale(0) contrast(1.2);
    }
    .cam-window-inner.cam-ghost-flash::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.32), transparent 55%);
      mix-blend-mode: screen;
      opacity: 0.7;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

/* =============== 3. Scene switching =============== */
function switchScene(name) {
  state.currentScene = name;
  Object.entries(scenes).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });

  if (name === "wall") {
    gazeDot.style.display = "block";
    gazeDotLogs.style.display = "none";
    updateWindowRects();
  } else if (name === "logs") {
    gazeDot.style.display = "none";
    gazeDotLogs.style.display = "block";
  } else {
    gazeDot.style.display = "none";
    gazeDotLogs.style.display = "none";
  }
}

/* =============== 4. Loading screen =============== */
function initLoadingScreen() {
  loadingTextEl.innerHTML =
    "Initializing WINDOW system...<br>" +
    "Connecting to remote CCTV grid...<br>" +
    "Preparing eye-tracking module...";

  btnStart.addEventListener("click", () => {
    calibrationOverlay.classList.remove("hidden");
  });

  btnCalibStart.addEventListener("click", () => {
    calibrationOverlay.classList.add("hidden");
    initGaze();
    switchScene("wall");
  });
}

/* =============== 5. CCTV wall =============== */
function createWallGrid() {
  const total = 6; // 3x3 grid
  for (let i = 0; i < total; i++) {
    const type = WINDOW_TYPES[i % WINDOW_TYPES.length];
    const camEl = document.createElement("div");
    camEl.className = "cam-window";

    const inner = document.createElement("div");
    inner.className = "cam-window-inner";
    inner.style.backgroundImage =
      "linear-gradient(135deg, #1e1e2f, #0d0f1a)";

    const label = document.createElement("div");
    label.className = "cam-label";
    label.textContent = `${type} / CAM_${String(i + 1).padStart(2, "0")}`;

    const rec = document.createElement("div");
    rec.className = "cam-rec";
    rec.textContent = "REC";

    camEl.appendChild(inner);
    camEl.appendChild(label);
    camEl.appendChild(rec);
    wallGrid.appendChild(camEl);

    state.wallWindows.push({
      el: camEl,
      innerEl: inner,
      type,
      fixationTime: 0,
      gazeHold: 0,
      reactStage: 0, // 0=无,1=soft,2=strong,3=ghost触发
    });

    camEl.addEventListener("click", () => {
      labelViewer.textContent = `You clicked: ${type}`;
      state.voyeurScore += type === "BEDROOM" ? 10 : 4;
      updateVoyeurScoreDisplay();
    });
  }

  updateWindowRects();
}

function updateVoyeurScoreDisplay() {
  scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
}

/* 从各类型凝视时间推断 Profile */
function updateViewerLabelFromStats() {
  const totalsByType = {};
  let totalFix = 0;

  for (const w of state.wallWindows) {
    totalsByType[w.type] =
      (totalsByType[w.type] || 0) + w.fixationTime;
    totalFix += w.fixationTime;
  }

  if (totalFix < 1) {
    labelViewer.textContent = "Not enough gaze data yet";
    return;
  }

  let dominantType = null;
  let dominantTime = 0;
  for (const [type, t] of Object.entries(totalsByType)) {
    if (t > dominantTime) {
      dominantTime = t;
      dominantType = type;
    }
  }

  const ratio = dominantTime / totalFix;
  let profile = "Balanced Observer";
  if (dominantType === "BEDROOM" && ratio > 0.4) {
    profile = "Bedroom Watcher";
  } else if (dominantType === "CORRIDOR" && ratio > 0.4) {
    profile = "Door & Corridor Stalker";
  } else if (ratio < 0.35) {
    profile = "Scanner (keeps jumping around)";
  }

  labelViewer.textContent = `Profile: ${profile} (${dominantType}, ${(ratio *
    100).toFixed(1)}% of gaze time)`;
}

/* 窗口对注视的反应（B + C 部分） */
function handleWindowGazeReaction(windowObj, dt) {
  const inner = windowObj.innerEl;
  const hold = windowObj.gazeHold;

  // 阶段阈值（秒）
  const softThreshold = 0.4;
  const strongThreshold = 0.9;
  const logThreshold = 1.4;
  const ghostThreshold = 2.2;

  // 低于很小的时间就重置
  if (hold < softThreshold * 0.5) {
    inner.classList.remove("cam-react-soft", "cam-react-strong");
    windowObj.reactStage = 0;
    return;
  }

  if (hold >= ghostThreshold && windowObj.reactStage < 3) {
    // 反向摄像头幽灵闪现
    inner.classList.add("cam-ghost-flash");
    windowObj.reactStage = 3;

    addLogLine(
      `[EYE] Prolonged fixation detected on ${windowObj.type} / ghost reflection injected.`,
      true
    );

    setTimeout(() => {
      inner.classList.remove("cam-ghost-flash");
    }, 220);
  } else if (hold >= logThreshold && windowObj.reactStage < 2) {
    inner.classList.add("cam-react-strong");
    windowObj.reactStage = 2;
    addLogLine(
      `[TRACE] User watching ${windowObj.type} feed for >1.4s.`,
      true
    );
  } else if (hold >= strongThreshold && windowObj.reactStage < 1) {
    inner.classList.add("cam-react-soft");
    windowObj.reactStage = 1;
  }
}

/* =============== 6. Log console =============== */
function initLogsScene() {
  const baseLogs = [
    "[SYSTEM] WINDOW daemon started.",
    "[CCTV] 9 remote channels connected.",
    "[EYE] Tracking module online.",
    "[RISK] Baseline level: LOW.",
  ];
  baseLogs.forEach((t) => addLogLine(t, false));

  btnToReport.addEventListener("click", () => {
    generateReport();
    switchScene("report");
  });
}

function addLogLine(text, sensitive = false) {
  const line = document.createElement("div");
  line.className = "log-line";
  if (sensitive) line.classList.add("sensitive");
  line.textContent = text;
  logLines.appendChild(line);
  logLines.scrollTop = logLines.scrollHeight;
}

/* =============== 7. Report =============== */
function generateReport() {
  const totalFix = state.wallWindows.reduce(
    (sum, w) => sum + w.fixationTime,
    0
  );
  const bedroomFix = state.wallWindows
    .filter((w) => w.type === "BEDROOM")
    .reduce((sum, w) => sum + w.fixationTime, 0);

  const bedroomRatio =
    totalFix > 0 ? (bedroomFix / totalFix) * 100 : 0;

  const text = `
    The system has recorded your gaze behavior during this session.<br><br>
    Although this early version only tracks basic fixation time, some tendencies are already visible:<br><br>
    • Your total <b>Voyeur Tendency Score</b> is: <b>${state.voyeurScore.toFixed(
      0
    )}</b><br>
    • Approximately <b>${bedroomRatio.toFixed(
      1
    )}%</b> of your visual attention was spent on BEDROOM-type feeds.<br><br>
    Future versions will analyze more complex gaze behaviors to generate personalized anti-surveillance responses.
  `;

  reportTextEl.innerHTML = text;
}

/* =============== 8. Eye tracking (smoothed + snap) =============== */
function initGaze() {
  if (!window.webgazer) {
    console.warn("WebGazer not available.");
    return;
  }

  webgazer
    .setRegression("ridge")
    .setGazeListener((data, timestamp) => {
      if (!data) return;
      let x = data.x;
      let y = data.y;

      // 1) 眨眼 / glitch 过滤
      if (state.lastRawGaze) {
        const dx = x - state.lastRawGaze.x;
        const dy = y - state.lastRawGaze.y;
        const dist = Math.hypot(dx, dy);
        // 太夸张的跳跃直接忽略
        if (dist > 700) {
          return;
        }
      }
      state.lastRawGaze = { x, y };

      // 2) 平滑窗口（逻辑用）
      const win = state.gazeSmoothingWindow;
      win.push({ x, y });
      if (win.length > 6) {
        win.shift();
      }

      let sumX = 0;
      let sumY = 0;
      for (const p of win) {
        sumX += p.x;
        sumY += p.y;
      }
      let avgX = sumX / win.length;
      let avgY = sumY / win.length;

      // 基于窗口的区域吸附（更灵敏）
      const snapped = snapToRegion(avgX, avgY, 140);
      avgX = snapped.x;
      avgY = snapped.y;

      const w = window.innerWidth;
      const h = window.innerHeight;
      avgX = Math.max(0, Math.min(w, avgX));
      avgY = Math.max(0, Math.min(h, avgY));

      // 计算稳定度抖动
      if (state.gazePositionPrev) {
        const dx = avgX - state.gazePositionPrev.x;
        const dy = avgY - state.gazePositionPrev.y;
        const jitter = Math.hypot(dx, dy);
        state.stabilitySamples.push(jitter);
        if (state.stabilitySamples.length > 60) {
          state.stabilitySamples.shift();
        }
      }
      state.gazePositionPrev = { x: avgX, y: avgY };

      // 更新逻辑用 gaze
      state.gazePosition = { x: avgX, y: avgY };
      state.gazeHistory.push({
        x: avgX,
        y: avgY,
        t: timestamp,
      });
      if (state.gazeHistory.length > 300) {
        state.gazeHistory.shift();
      }

      // 3) 红点再做一层缓动（视觉平滑）
      const alpha = 0.28;
      const dp = state.displayDotPos;
      dp.x = dp.x + alpha * (avgX - dp.x);
      dp.y = dp.y + alpha * (avgY - dp.y);

      if (state.currentScene === "wall") {
        gazeDot.style.left = dp.x + "px";
        gazeDot.style.top = dp.y + "px";
      } else if (state.currentScene === "logs") {
        gazeDotLogs.style.left = dp.x + "px";
        gazeDotLogs.style.top = dp.y + "px";
      }
    })
    .begin()
    .then(() => {
      if (webgazer.showVideo) webgazer.showVideo(false);
      if (webgazer.showFaceOverlay)
        webgazer.showFaceOverlay(false);
      if (webgazer.showFaceFeedbackBox)
        webgazer.showFaceFeedbackBox(false);
      if (webgazer.showPredictionPoints)
        webgazer.showPredictionPoints(false); // 只保留我们自己的红点
      state.gazeEnabled = true;
      console.log("[EYE] WebGazer started.");
    })
    .catch((err) => {
      console.error("WebGazer failed:", err);
    });

  // 每 120ms 更新一次注视窗口 / 分数 / 反应
  setInterval(updateWallFixationsByGaze, 120);
}

function pointInElement(x, y, el) {
  const rect = el.getBoundingClientRect();
  const margin = 80; // 放宽命中范围

  return (
    x >= rect.left - margin &&
    x <= rect.right + margin &&
    y >= rect.top - margin &&
    y <= rect.bottom + margin
  );
}

function updateWallFixationsByGaze() {
  if (state.currentScene !== "wall" || !state.gazeEnabled) return;

  const { x, y } = state.gazePosition;
  const dt = 0.12;

  let hitWindow = null;
  for (const w of state.wallWindows) {
    if (pointInElement(x, y, w.el)) {
      hitWindow = w;
      break;
    }
  }

  // 高亮当前窗口
  if (hitWindow !== state.lastFocusedWindow) {
    if (state.lastFocusedWindow && state.lastFocusedWindow.el) {
      state.lastFocusedWindow.el.classList.remove("focused");
    }
    if (hitWindow && hitWindow.el) {
      hitWindow.el.classList.add("focused");
    }
    state.lastFocusedWindow = hitWindow;
  }

  // 更新各窗口的 gazeHold + 反应
  for (const w of state.wallWindows) {
    if (w === hitWindow) {
      w.gazeHold += dt;
      w.fixationTime += dt;
    } else {
      // 缓慢衰减，避免立刻清零
      w.gazeHold = Math.max(0, w.gazeHold - dt * 2);
    }
    handleWindowGazeReaction(w, dt);
  }

  if (hitWindow) {
    state.voyeurScore +=
      hitWindow.type === "BEDROOM" ? 0.3 : 0.1;
    updateVoyeurScoreDisplay();
    updateViewerLabelFromStats();
  }
}

/* =============== 9. Buttons & init =============== */
function initSceneButtons() {
  btnToLogs.addEventListener("click", () => {
    switchScene("logs");
    addLogLine(
      "[SYSTEM] User moved to LOG CONSOLE.",
      false
    );
    addLogLine(
      "[TRACE] Approx. locale: UNKNOWN_CITY / UNKNOWN_REGION.",
      true
    );
  });

  btnRestart.addEventListener("click", () => {
    window.location.reload();
  });
}

function init() {
  switchScene("loading");
  injectWindowEffectStyles();
  initLoadingScreen();
  createWallGrid();
  initLogsScene();
  initSceneButtons();
  createEyeStabilityHud();
  setInterval(updateEyeStabilityHud, 1000);

  window.addEventListener("resize", () => {
    if (state.currentScene === "wall") {
      updateWindowRects();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
