/**
 * PreloadScene - Loads game assets and resolves immediately (no animation).
 */

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
  return loadProjectAssets();
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
