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

  const logLines = document.getElementById("log-lines");
  const reportText = document.getElementById("report-text");

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
  //  GAZE SMOOTHING
  // =====================================================
  const SMOOTH = 0.25;

  function smooth(x, y) {
    if (state.smoothedX === null) {
      state.smoothedX = x;
      state.smoothedY = y;
      return { x, y };
    }

    state.smoothedX += (x - state.smoothedX) * SMOOTH;
    state.smoothedY += (y - state.smoothedY) * SMOOTH;

    return { x: state.smoothedX, y: state.smoothedY };
  }

  // =====================================================
  //  GAZE LISTENER
  // =====================================================
  function onGaze(pred) {
    if (!pred || !state.gazeEnabled) return;

    const { x, y } = smooth(pred.x, pred.y);
    gazeDot.style.transform = `translate(${x}px, ${y}px)`;

    const el = document.elementFromPoint(x, y);
    if (!el) return;

    const cam = el.closest(".cam-window");
    if (cam) highlight(cam);
  }

  // =====================================================
  //  HIGHLIGHT CAM
  // =====================================================
  let lastCam = null;
  let gazeTicks = 0;

  function highlight(cam) {
    if (lastCam !== cam) {
      document.querySelectorAll(".cam-window").forEach((c) => c.classList.remove("focused"));
      cam.classList.add("focused");

      lastCam = cam;
      gazeTicks = 0;

      labelViewer.innerText = cam.dataset.label;
    }

    gazeTicks++;
    if (gazeTicks % 60 === 0) {
      state.voyeurScore++;
      scoreVoyeur.innerText = state.voyeurScore;
    }
  }

  // =====================================================
  //  START EYE TRACKING
  // =====================================================
  async function startEyeTracking() {
    console.log("[EYE] Starting WebGazer…");

    try {
      await webgazer.setRegression("ridge");
      await webgazer.setTracker("clmtrackr");
      webgazer.setGazeListener(onGaze);

      await webgazer.begin();

      state.gazeEnabled = true;
      console.log("[EYE] WebGazer ready.");
    } catch (err) {
      console.error("[EYE] Error but continue:", err);
    }
  }

  // =====================================================
  //  START BUTTON
  // =====================================================
  function initLoadingScreen() {
    if (!btnStart) return;

    btnStart.addEventListener("click", async () => {
      console.log("[UI] Start Calibration clicked.");

      try {
        await startEyeTracking();
      } catch (err) {
        console.error("[EYE] Failed:", err);
      } finally {
        goToScene("wall"); // ALWAYS GO TO WALL
      }
    });
  }

  // =====================================================
  //  LOG SCREEN
  // =====================================================
  function initLogs() {
    if (!btnToLogs) return;

    btnToLogs.addEventListener("click", () => {
      logLines.innerHTML = state.logs.join("<br>");
      goToScene("logs");
    });
  }

  // =====================================================
  //  REPORT SCREEN
  // =====================================================
  function initReport() {
    if (btnToReport) {
      btnToReport.addEventListener("click", () => {
        reportText.innerHTML = `
          <h3>Behavior Summary</h3>
          <p>Most Watched: <b>${labelViewer.innerText}</b></p>
          <p>Voyeur Score: <b>${state.voyeurScore}</b></p>
        `;
        goToScene("report");
      });
    }

    if (btnRestart) {
      btnRestart.addEventListener("click", () => {
        location.reload();
      });
    }
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

})(); // <— THIS WAS MISSING IN YOUR FILE
