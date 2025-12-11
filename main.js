// =====================================================
//   WINDOW PROJECT — Full main.js (Stable WebGazer Version)
// =====================================================

(() => {
  console.log("%c[WINDOW] System initializing…", "color:#6cf");

  // =====================================================
  //  GLOBAL STATE
  // =====================================================
  const state = {
    currentScene: "loading",
    gazeEnabled: false,
    gazeStability: 0,
    smoothedX: null,
    smoothedY: null,
    currentCam: null,
    voyeurScore: 0,
    logs: [],
  };

  // =====================================================
  //  DOM REFERENCES
  // =====================================================
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

  const labelViewer = document.getElementById("label-viewer");
  const scoreVoyeur = document.getElementById("score-voyeur");
  const gazeDot = document.getElementById("gaze-dot");
  const stabilityBar = document.getElementById("eye-stability");

  const logLines = document.getElementById("log-lines");
  const reportText = document.getElementById("report-text");

  const calibrationOverlay = document.getElementById("calibration-overlay");
  const btnCalibStart = document.getElementById("btn-calib-start");

  const wallGrid = document.getElementById("wall-grid");


  // =====================================================
  //  SCENE SWITCHING
  // =====================================================
  function goToScene(name) {
    Object.values(scenes).forEach((s) => s && s.classList.remove("active"));

    const target = scenes[name];
    if (target) target.classList.add("active");

    state.currentScene = name;
    console.log("[UI] Switched to:", name);
  }


  // =====================================================
  //  CREATE WALL GRID (6 CAMERAS)
  // =====================================================
  const ROOM_LABELS = ["BEDROOM", "KITCHEN", "STAIRCASE", "GARAGE", "HALLWAY", "STORAGE"];

  function createWallGrid() {
    if (!wallGrid) return;

    wallGrid.innerHTML = "";
    const total = 6;

    for (let i = 0; i < total; i++) {
      const cam = document.createElement("div");
      cam.className = "cam-window";
      cam.dataset.index = i;
      cam.dataset.label = ROOM_LABELS[i];

      const inner = document.createElement("div");
      inner.className = "cam-window-inner";

      inner.innerHTML = `
        <span class="cam-label">${ROOM_LABELS[i]} // CAM_0${i + 1}</span>
      `;

      cam.appendChild(inner);
      wallGrid.appendChild(cam);
    }
  }


  // =====================================================
  //  GAZE SMOOTHING (One-Euro Filter style)
  // =====================================================
  const SMOOTHING = 0.25;

  function smoothGaze(x, y) {
    if (state.smoothedX === null) {
      state.smoothedX = x;
      state.smoothedY = y;
      return { x, y };
    }

    state.smoothedX = state.smoothedX + (x - state.smoothedX) * SMOOTHING;
    state.smoothedY = state.smoothedY + (y - state.smoothedY) * SMOOTHING;

    return { x: state.smoothedX, y: state.smoothedY };
  }


  // =====================================================
  //  GAZE LISTENER
  // =====================================================
  function onGaze(pred) {
    if (!pred || !state.gazeEnabled) return;

    const { x, y } = smoothGaze(pred.x, pred.y);
    if (!x || !y) return;

    // move red dot
    gazeDot.style.transform = `translate(${x}px, ${y}px)`;

    const el = document.elementFromPoint(x, y);
    if (el && el.closest(".cam-window")) {
      const cam = el.closest(".cam-window");
      highlightCamera(cam);
    }
  }


  // =====================================================
  //  HIGHLIGHTING + SCORE
  // =====================================================
  let lastHighlight = null;
  let highlightTimer = 0;

  function highlightCamera(cam) {
    if (!cam) return;

    if (lastHighlight !== cam) {
      document.querySelectorAll(".cam-window").forEach((c) => c.classList.remove("focused"));
      cam.classList.add("focused");
      lastHighlight = cam;
      highlightTimer = 0;

      labelViewer.innerText = cam.dataset.label;
    }

    highlightTimer++;

    // generate voyeur score
    if (highlightTimer % 60 === 0) {
      state.voyeurScore += 1;
      scoreVoyeur.innerText = state.voyeurScore;
    }
  }


  // =====================================================
  //  EYETRACKING INITIALIZATION
  // =====================================================
  async function startEyeTracking() {
    console.log("[EYE] Starting WebGazer...");

    try {
      await webgazer.setRegression("ridge");
      await webgazer.setTracker("clmtrackr");
      webgazer.setGazeListener(onGaze);
      await webgazer.begin();

      state.gazeEnabled = true;
      console.log("[EYE] WebGazer fully initialized.");
    } catch (err) {
      console.error("[EYE] ERROR (ignored):", err);
    }
  }


  // =====================================================
  //  LOADING PAGE — START BUTTON
  // =====================================================
  function initLoadingScreen() {
    if (!btnStart) return;

    btnStart.addEventListener("click", async () => {
      console.log("[UI] Start pressed");

      try {
        await startEyeTracking();
      } catch (e) {
        console.error("[EYE] Init failure:", e);
      } finally {
        goToScene("wall");
      }
    });
  }


  // =====================================================
  //  LOG PANEL
  // =====================================================
  function initLogs() {
    if (!btnToLogs) return;

    btnToLogs.addEventListener("click", () => {
      logLines.innerHTML = state.logs.join("<br>");
      goToScene("logs");
    });
  }


  // =====================================================
  //  REPORT PANEL
  // =====================================================
  function initReport() {
    if (!btnToReport) return;

    btnToReport.addEventListener("click", () => {
      reportText.innerHTML = `
        <h3>Behavior Summary</h3>
        <p>You spent most time watching: <b>${labelViewer.innerText}</b></p>
        <p>Your voyeur tendency score: <b>${state.voyeurScore}</b></p>
      `;
      goToScene("report");
    });

    btnRestart.addEventListener("click", () => {
      location.reload();
    });
  }


  // =====================================================
  //  INIT
  // =====================================================
  function init() {
    console.log("[SYS] INIT");

    goToScene("loading");
    createWallGrid();
    initLoadingScreen();
    initLogs();
    initReport();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
