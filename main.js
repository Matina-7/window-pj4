(() => {

  console.log("[WINDOW] System initializing...");

  const state = {
    currentScene: "loading",
    gazeEnabled: false,
    smoothedX: null,
    smoothedY: null,
    voyeurScore: 0,
    lastCam: null,
    gazeTicks: 0
  };

  const scenes = {
    loading: document.getElementById("scene-loading"),
    wall: document.getElementById("scene-wall"),
    logs: document.getElementById("scene-logs")
  };

  const btnStart = document.getElementById("btn-start");
  const btnRestart = document.getElementById("btn-restart");

  const wallGrid = document.getElementById("wall-grid");
  const gazeDot = document.getElementById("gaze-dot");
  const labelViewer = document.getElementById("label-viewer");
  const scoreVoyeur = document.getElementById("score-voyeur");

  // ----------------------------
  // Scene switching
  // ----------------------------
  function goTo(name) {
    Object.values(scenes).forEach(s => s.classList.remove("active"));
    scenes[name].classList.add("active");
    console.log("[UI] Switched to:", name);
  }

  // ----------------------------
  // Create 6 CCTV windows
  // ----------------------------
  const LABELS = ["BEDROOM", "KITCHEN", "STAIRCASE", "GARAGE", "HALLWAY", "STORAGE"];

  function createWallGrid() {
    wallGrid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const box = document.createElement("div");
      box.className = "cam-window";
      box.dataset.label = LABELS[i];

      box.innerHTML = `
        <div class="cam-window-inner">
          <span class="cam-label">${LABELS[i]} // CAM_0${i+1}</span>
        </div>
      `;

      wallGrid.appendChild(box);
    }
  }

  // ----------------------------
  // Gaze smoothing
  // ----------------------------
  const SMOOTH = 0.25;
  function smooth(x, y) {
    if (state.smoothedX == null) {
      state.smoothedX = x;
      state.smoothedY = y;
    } else {
      state.smoothedX += (x - state.smoothedX) * SMOOTH;
      state.smoothedY += (y - state.smoothedY) * SMOOTH;
    }
    return { x: state.smoothedX, y: state.smoothedY };
  }

  // ----------------------------
  // Gaze listener
  // ----------------------------
  function onGaze(pred) {
    if (!pred || !state.gazeEnabled) return;

    const { x, y } = smooth(pred.x, pred.y);
    gazeDot.style.transform = `translate(${x}px, ${y}px)`;

    const el = document.elementFromPoint(x, y);
    if (!el) return;

    const cam = el.closest(".cam-window");
    if (cam) highlight(cam);
  }

  function highlight(cam) {
    if (state.lastCam !== cam) {
      document.querySelectorAll(".cam-window").forEach(c => c.classList.remove("focused"));
      cam.classList.add("focused");

      labelViewer.textContent = cam.dataset.label;

      state.lastCam = cam;
      state.gazeTicks = 0;
    }

    state.gazeTicks++;
    if (state.gazeTicks % 50 === 0) {
      state.voyeurScore++;
      scoreVoyeur.textContent = state.voyeurScore;
    }
  }

  // ----------------------------
  // Start Eye Tracking
  // ----------------------------
  async function startEyeTracking() {
    console.log("[EYE] Starting WebGazer...");

    // Fix for 0x0 webcam bug
    const v = document.getElementById("webgazerVideoFeed");
    if (v) {
      v.width = 320;
      v.height = 240;
    }

    try {
      await webgazer.setRegression("ridge");
      await webgazer.setTracker("clmtrackr");
      webgazer.setGazeListener(onGaze);
      await webgazer.begin();

      state.gazeEnabled = true;
      gazeDot.style.display = "block";

      console.log("[EYE] Ready.");
    } catch (e) {
      console.error("[EYE] Error:", e);
    }
  }

  // ----------------------------
  // INIT
  // ----------------------------
  function init() {
    createWallGrid();

    btnStart.addEventListener("click", async () => {
      console.log("[UI] Start clicked");
      goTo("wall");
      await startEyeTracking();
    });

    if (btnRestart) {
      btnRestart.addEventListener("click", () => location.reload());
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
