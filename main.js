// main.js - WINDOW base version with smoothed eye tracking & visible gaze dot

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
  wallWindows: [], // {el, type, fixationTime}
  voyeurScore: 0,
  gazeEnabled: false,
  gazePosition: { x: 0, y: 0 },
  gazeHistory: [],
  gazeSmoothingWindow: [],   // for smoothing raw gaze positions
  lastFocusedWindow: null,
};

const WINDOW_TYPES = ["BEDROOM", "OFFICE", "CORRIDOR", "ELEVATOR", "LOBBY", "KITCHEN"];

/* =============== 2. Scene switching =============== */
function switchScene(name) {
  state.currentScene = name;
  Object.entries(scenes).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });

  // Control which gaze dot is visible
  if (name === "wall") {
    gazeDot.style.display = "block";
    gazeDotLogs.style.display = "none";
  } else if (name === "logs") {
    gazeDot.style.display = "none";
    gazeDotLogs.style.display = "block";
  } else {
    gazeDot.style.display = "none";
    gazeDotLogs.style.display = "none";
  }
}

/* =============== 3. Loading screen =============== */
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

/* =============== 4. CCTV wall =============== */
function createWallGrid() {
  const total = 9; // 3x3 grid
  for (let i = 0; i < total; i++) {
    const type = WINDOW_TYPES[i % WINDOW_TYPES.length];
    const camEl = document.createElement("div");
    camEl.className = "cam-window";

    const inner = document.createElement("div");
    inner.className = "cam-window-inner";
    inner.style.backgroundImage = "linear-gradient(135deg, #1e1e2f, #0d0f1a)";

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
      type,
      fixationTime: 0,
    });

    camEl.addEventListener("click", () => {
      labelViewer.textContent = `You clicked: ${type}`;
      state.voyeurScore += type === "BEDROOM" ? 10 : 4;
      updateVoyeurScoreDisplay();
    });
  }
}

function updateVoyeurScoreDisplay() {
  scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
}

// Analyze fixation by type and update label
function updateViewerLabelFromStats() {
  const totalsByType = {};
  let totalFix = 0;

  for (const w of state.wallWindows) {
    totalsByType[w.type] = (totalsByType[w.type] || 0) + w.fixationTime;
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

  labelViewer.textContent = `Profile: ${profile} (${dominantType}, ${(ratio * 100).toFixed(
    1
  )}% of gaze time)`;
}

/* =============== 5. Log console =============== */
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

/* =============== 6. Report =============== */
function generateReport() {
  const totalFix = state.wallWindows.reduce((sum, w) => sum + w.fixationTime, 0);
  const bedroomFix = state.wallWindows
    .filter((w) => w.type === "BEDROOM")
    .reduce((sum, w) => sum + w.fixationTime, 0);

  const bedroomRatio = totalFix > 0 ? (bedroomFix / totalFix) * 100 : 0;

  const text = `
    The system has recorded your gaze behavior during this session.<br><br>
    Although this early version only tracks basic fixation time, some tendencies are already visible:<br><br>
    • Your total <b>Voyeur Tendency Score</b> is: <b>${state.voyeurScore.toFixed(0)}</b><br>
    • Approximately <b>${bedroomRatio.toFixed(
      1
    )}%</b> of your visual attention was spent on BEDROOM-type feeds.<br><br>
    Future versions will analyze more complex gaze behaviors to generate personalized anti-surveillance responses.
  `;

  reportTextEl.innerHTML = text;
}

/* =============== 7. Eye tracking (smoothed) =============== */
function initGaze() {
  if (!window.webgazer) {
    console.warn("WebGazer not available.");
    return;
  }

  webgazer
    .setRegression("ridge")
    .setGazeListener((data, timestamp) => {
      if (!data) return;
      const x = data.x;
      const y = data.y;

      // --- smoothing: keep last N points and use their average ---
      const win = state.gazeSmoothingWindow;
      win.push({ x, y });
      if (win.length > 6) {
        win.shift(); // keep only last 6 points -> smoother but still responsive
      }

      let sumX = 0;
      let sumY = 0;
      for (const p of win) {
        sumX += p.x;
        sumY += p.y;
      }
      const avgX = sumX / win.length;
      const avgY = sumY / win.length;

      state.gazePosition = { x: avgX, y: avgY };
      state.gazeHistory.push({ x: avgX, y: avgY, t: timestamp });

      // Move visible gaze dot using smoothed position
      if (state.currentScene === "wall") {
        gazeDot.style.left = avgX + "px";
        gazeDot.style.top = avgY + "px";
      } else if (state.currentScene === "logs") {
        gazeDotLogs.style.left = avgX + "px";
        gazeDotLogs.style.top = avgY + "px";
      }
    })
    .begin()
    .then(() => {
      if (webgazer.showVideo) webgazer.showVideo(false);
      if (webgazer.showFaceOverlay) webgazer.showFaceOverlay(false);
      if (webgazer.showFaceFeedbackBox) webgazer.showFaceFeedbackBox(false);
      state.gazeEnabled = true;
      console.log("[EYE] WebGazer started.");
    })
    .catch((err) => {
      console.error("WebGazer failed:", err);
    });

  // Update gaze-based fixation and highlighting more frequently (100ms)
  setInterval(updateWallFixationsByGaze, 100);
}

function pointInElement(x, y, el) {
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function updateWallFixationsByGaze() {
  if (state.currentScene !== "wall" || !state.gazeEnabled) return;

  const { x, y } = state.gazePosition;
  const dt = 0.1; // 100ms

  let hitWindow = null;
  for (const w of state.wallWindows) {
    if (pointInElement(x, y, w.el)) {
      hitWindow = w;
      break;
    }
  }

  // Highlight current focused window
  if (hitWindow !== state.lastFocusedWindow) {
    if (state.lastFocusedWindow && state.lastFocusedWindow.el) {
      state.lastFocusedWindow.el.classList.remove("focused");
    }
    if (hitWindow && hitWindow.el) {
      hitWindow.el.classList.add("focused");
    }
    state.lastFocusedWindow = hitWindow;
  }

  if (hitWindow) {
    hitWindow.fixationTime += dt;
    state.voyeurScore += hitWindow.type === "BEDROOM" ? 0.3 : 0.1;
    updateVoyeurScoreDisplay();
    updateViewerLabelFromStats();
  }
}

/* =============== 8. Buttons & init =============== */
function initSceneButtons() {
  btnToLogs.addEventListener("click", () => {
    switchScene("logs");
    addLogLine("[SYSTEM] User moved to LOG CONSOLE.", false);
    addLogLine("[TRACE] Approx. locale: UNKNOWN_CITY / UNKNOWN_REGION.", true);
  });

  btnRestart.addEventListener("click", () => {
    window.location.reload();
  });
}

function init() {
  switchScene("loading");
  initLoadingScreen();
  createWallGrid();
  initLogsScene();
  initSceneButtons();
}

document.addEventListener("DOMContentLoaded", init);
