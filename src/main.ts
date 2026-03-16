import GameSettings from "./config/GameSettings";
import { run } from "./scenes/GameScene";
import { runPreloadScene } from "./scenes/PreloadScene";

// Setup default game config if not provided by platform
if (!window.gameConfig) {
  window.gameConfig = { ...GameSettings.defaults };
}

// Setup lib mock for development (in production, platform provides the real lib)
if (!window.lib) {
  window.lib = {
    log: (msg: string) => console.log("[Game]", msg),
    getAsset: () => null,
    addPlayerScoreToLeaderboard: async () => ({
      success: false,
      entries: [],
      userRank: null,
    }),
    getUserGameState: async () => {
      try {
        const saved = localStorage.getItem("frisbee-loop-state");
        return saved ? { state: JSON.parse(saved) } : null;
      } catch {
        return null;
      }
    },
    saveUserGameState: async (state: Record<string, unknown>) => {
      try {
        localStorage.setItem("frisbee-loop-state", JSON.stringify(state));
      } catch {
        // ignore
      }
    },
    showGameParameters: () => {},
  };
}

// Preload scene → then start the game
async function boot(): Promise<void> {
  const audio = await runPreloadScene();
  await run("play", audio);

  // Hide loading screen after game scene is fully initialized and rendering
  requestAnimationFrame(() => {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.style.transition = "opacity 0.3s ease";
      loadingScreen.style.opacity = "0";
      setTimeout(() => {
        loadingScreen.style.display = "none";
      }, 300);
    }
  });
}

boot();
