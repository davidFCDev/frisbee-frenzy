/**
 * PreloadScene - Adapted from PreloadSceneBase for Three.js projects
 *
 * Shows a spritesheet boot animation while loading game assets.
 * When both animation and loading finish, hides the loading screen
 * and resolves with the loaded audio data.
 */

// ============================================================
// SPRITESHEET CONFIG
// ============================================================

const SPRITESHEET_URL =
  "https://remix.gg/blob/13e738d9-e135-454e-9d2a-e456476a0c5e/sprite-start-oVCq0bchsVLwbLqAPbLgVOrQqxcVh5.webp?Cbzd";
const FRAME_WIDTH = 241;
const FRAME_HEIGHT = 345;
const TOTAL_FRAMES = 18;
const FRAME_RATE = 12;
const LAST_FRAME_HOLD_MS = 500;

// ============================================================
// TYPES
// ============================================================

export interface PreloadedAudio {
  context: AudioContext;
  buffers: Record<string, AudioBuffer>;
  gainNode: GainNode;
}

// ============================================================
// PRELOAD SCENE
// ============================================================

export async function runPreloadScene(): Promise<PreloadedAudio> {
  let assetsLoaded = false;
  let animationComplete = false;

  let resolvePreload!: (result: PreloadedAudio) => void;
  const promise = new Promise<PreloadedAudio>((resolve) => {
    resolvePreload = resolve;
  });

  // Audio data that will be populated during asset loading
  let audioCtx: AudioContext;
  let audioBuffs: Record<string, AudioBuffer> = {};
  let musicGain: GainNode;

  // ---- Setup canvas inside loading screen ----
  const loadingScreen = document.getElementById("loading-screen")!;
  const loadingContent = document.getElementById("loading-content")!;

  // Replace loading bar with a canvas for the sprite animation
  loadingContent.innerHTML = "";

  const canvas = document.createElement("canvas");
  const displayScale = Math.min(
    window.innerWidth / 550,
    window.innerHeight / 750,
    1.0,
  );
  canvas.width = Math.round(FRAME_WIDTH * displayScale);
  canvas.height = Math.round(FRAME_HEIGHT * displayScale);
  canvas.style.display = "block";
  canvas.style.margin = "0 auto";
  loadingContent.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;

  // ---- Load spritesheet and play animation ----
  const spritesheet = await loadImage(SPRITESHEET_URL);
  const cols = Math.floor(spritesheet.width / FRAME_WIDTH);

  let currentFrame = 0;
  let lastFrameTime = performance.now();
  const frameDuration = 1000 / FRAME_RATE;
  let holdingLastFrame = false;
  let holdStart = 0;

  function drawFrame(frameIndex: number): void {
    const sx = (frameIndex % cols) * FRAME_WIDTH;
    const sy = Math.floor(frameIndex / cols) * FRAME_HEIGHT;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      spritesheet,
      sx,
      sy,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  // Draw first frame immediately
  drawFrame(0);

  function animate(now: number): void {
    if (holdingLastFrame) {
      if (now - holdStart >= LAST_FRAME_HOLD_MS) {
        animationComplete = true;
        checkTransition();
        return;
      }
      requestAnimationFrame(animate);
      return;
    }

    if (now - lastFrameTime >= frameDuration) {
      drawFrame(currentFrame);
      currentFrame++;
      lastFrameTime = now;

      if (currentFrame >= TOTAL_FRAMES) {
        holdingLastFrame = true;
        holdStart = now;
      }
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // ---- Load project assets in parallel ----
  loadProjectAssets().then(({ context, buffers, gainNode }) => {
    audioCtx = context;
    audioBuffs = buffers;
    musicGain = gainNode;
    assetsLoaded = true;
    checkTransition();
  });

  // ---- Transition check (same pattern as PreloadSceneBase) ----
  function checkTransition(): void {
    if (animationComplete && assetsLoaded) {
      // Resolve immediately so the game scene can initialize behind the loading screen
      resolvePreload({
        context: audioCtx,
        buffers: audioBuffs,
        gainNode: musicGain,
      });
    }
  }

  return promise;
}

// ============================================================
// PROJECT ASSETS (equivalent to loadProjectAssets in PreloadSceneBase)
// ============================================================

async function loadProjectAssets(): Promise<PreloadedAudio> {
  const imageAssets = [
    "thrower_character",
    "receiver_character",
    "frisbee",
    "obstacle_pole",
    "base_marker",
    "background_stadium",
  ];

  const audioAssets = [
    "throw_sound",
    "catch_sound",
    "collision_sound",
    "background_music",
  ];

  // Initialize audio context
  const context = new (
    window.AudioContext || (window as any).webkitAudioContext
  )();
  const gainNode = context.createGain();
  gainNode.connect(context.destination);
  gainNode.gain.value = 0.3;

  const buffers: Record<string, AudioBuffer> = {};

  // Load images (just warm the browser cache)
  const imagePromises = imageAssets.map(
    (id) =>
      new Promise<void>((resolve) => {
        const assetInfo = window.lib.getAsset(id);
        if (assetInfo && assetInfo.url) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = assetInfo.url;
        } else {
          resolve();
        }
      }),
  );

  // Load audio buffers
  const audioPromises = audioAssets.map(
    (id) =>
      new Promise<void>((resolve) => {
        const assetInfo = window.lib.getAsset(id);
        if (assetInfo && assetInfo.url) {
          fetch(assetInfo.url)
            .then((r) => r.arrayBuffer())
            .then((buf) => context.decodeAudioData(buf))
            .then((decoded) => {
              buffers[id] = decoded;
              resolve();
            })
            .catch(() => resolve());
        } else {
          resolve();
        }
      }),
  );

  await Promise.all([...imagePromises, ...audioPromises]);
  console.log("[PreloadScene] All assets loaded");

  return { context, buffers, gainNode };
}

// ============================================================
// UTILS
// ============================================================

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
