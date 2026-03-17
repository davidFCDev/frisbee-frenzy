/**
 * Infinity Frisbee - 3D Frisbee Throwing Game
 * Complete game logic using Three.js
 */
import GameSettings from "../config/GameSettings";
import type { PreloadedAudio } from "./PreloadScene";

// ============================================================
// TYPES
// ============================================================

interface FrisbeeDesign {
  id: string;
  name: string;
  unlockScore: number;
  baseColor: number;
  rimColor: number;
  starColor: number;
}

interface TrailSegment {
  position: THREE.Vector3;
  rotation: number;
  age: number;
}

interface PoleData {
  mesh: THREE.Group;
  baseX: number;
  range: number;
  speed: number;
  phase: number;
  direction: number;
  canPause: boolean;
  isPaused: boolean;
  pauseTimer: number;
  pauseDuration: number;
  lastDirection: number;
  pauseCooldown: number;
  pauseCooldownDuration: number;
  pausedPosition: number;
}

interface WallData {
  mesh: THREE.Group;
  maxY: number;
  speed: number;
  phase: number;
  width: number;
  height: number;
  isSplit?: boolean;
  segments?: THREE.Group[];
}

interface FireworkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  initialColor: number;
  trail: unknown[];
}

interface RingData {
  mesh: THREE.Group;
  zPos: number;
  xPos: number;
  yPos: number;
  radius: number;
  collected: boolean;
  rotationSpeed: number;
}

interface CurvePath {
  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  duration: number;
}

interface GameState {
  phase: string;
  score: number;
  bestScore: number;
  combo: number;
  lives: number;
  throwerPos: THREE.Vector3;
  receiverPos: THREE.Vector3;
  frisbeePos: THREE.Vector3;
  frisbeeVel: THREE.Vector3;
  frisbeeRotation: number;
  isDragging: boolean;
  dragStart: { x: number; y: number };
  dragCurrent: { x: number; y: number };
  throwPower: number;
  throwAngleH: number;
  throwAngleV: number;
  currentDifficulty: number;
  poleCount: number;
  poleSpeed: number;
  gapWidth: number;
  transitionProgress: number;
  cameraTargetPos: THREE.Vector3;
  throwAnimProgress: number;
  throwAnimDuration: number;
  curvePath?: CurvePath;
  collisionAnimTime: number;
  collisionStartPos?: THREE.Vector3;
  collisionVelocity?: THREE.Vector3;
  collisionRotVel: number;
  multiplier: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const frisbeeDesigns: FrisbeeDesign[] = [
  {
    id: "classic",
    name: "Classic",
    unlockScore: 0,
    baseColor: 0xffffff,
    rimColor: 0xff1493,
    starColor: 0xff1493,
  },
  {
    id: "golden",
    name: "Golden",
    unlockScore: 10,
    baseColor: 0xffd700,
    rimColor: 0xff8c00,
    starColor: 0xffffff,
  },
  {
    id: "ocean",
    name: "Ocean",
    unlockScore: 20,
    baseColor: 0x00ced1,
    rimColor: 0x1e90ff,
    starColor: 0xffffff,
  },
  {
    id: "fire",
    name: "Fire",
    unlockScore: 30,
    baseColor: 0xff4500,
    rimColor: 0xff0000,
    starColor: 0xffff00,
  },
  {
    id: "galaxy",
    name: "Galaxy",
    unlockScore: 40,
    baseColor: 0x9370db,
    rimColor: 0xff00ff,
    starColor: 0x00ffff,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    unlockScore: 50,
    baseColor: 0xff1493,
    rimColor: 0x00ff88,
    starColor: 0xffd700,
  },
];

// ============================================================
// MODULE STATE
// ============================================================

let selectedFrisbeeId = "classic";

// Three.js core
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let groundMesh: THREE.Mesh;
let skyMesh: THREE.Mesh;
let dirLight: THREE.DirectionalLight;

// Game objects
let throwerSprite: THREE.Group;
let receiverSprite: THREE.Group;
let frisbeeMesh: THREE.Group;
let frisbeeTrail: TrailSegment[] = [];
let trailMeshes: THREE.Mesh[] = [];
let poles: PoleData[] = [];
let walls: WallData[] = [];
let baseMarkers: THREE.Mesh[] = [];
let baseLines: THREE.Mesh[] = [];
let fireworksParticles: FireworkParticle[] = [];
let rings: RingData[] = [];
let stadiumElements: THREE.Object3D[] = [];

// Audio
let audioContext: AudioContext | null = null;
let audioBuffers: Record<string, AudioBuffer> = {};
let musicSource: AudioBufferSourceNode | null = null;
let musicGainNode: GainNode | null = null;
let isMuted = false;

// Music tracks - alternate between two songs
const MUSIC_URLS = [
  "https://remix.gg/blob/bc448687-3c6a-4d23-8ae6-cb80793ea667/music2-ifVBYVlyPa-wpGlk7Na9R0RpIhHPZc1US7SdBQkjy.mp3?c6RY",
  "https://remix.gg/blob/bc448687-3c6a-4d23-8ae6-cb80793ea667/music1-rTr7oTZyHa-wWvN1d7TczfkXTFX3G3KelKgp1qZsO.mp3?jpHA",
];
let musicBuffers: AudioBuffer[] = [];
let currentMusicTrack = 0;

// Game state
let gameState: GameState;

let currentMode = "play";
let lastTime = 0;
let lastStadiumUpdate = 0;
let animFrameId = 0;

// Design aspect ratio from settings (used as reference for camera)
const DESIGN_W = GameSettings.canvas.width;
const DESIGN_H = GameSettings.canvas.height;

// ============================================================
// RESIZE HANDLER — keeps renderer & camera matched to container
// ============================================================

function resizeRenderer(): void {
  if (!renderer || !camera) return;
  const container = renderer.domElement.parentElement;
  if (!container) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false); // false → don't touch CSS styles

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  // Also resize the trajectory overlay canvas
  const tc = document.getElementById(
    "trajectory-canvas",
  ) as HTMLCanvasElement | null;
  if (tc) {
    tc.width = w * dpr;
    tc.height = h * dpr;
    const ctx = tc.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }

  // Adjust score badge position: taller than 2:3 → push down
  const scoreWrapper = document.getElementById("score-wrapper");
  if (scoreWrapper) {
    const aspectRatio = w / h;
    const is2by3 = Math.abs(aspectRatio - 2 / 3) < 0.02;
    scoreWrapper.style.top = is2by3 || aspectRatio > 2 / 3 ? "18px" : "50px";
  }
}

// ============================================================
// HELPER: Get current frisbee design
// ============================================================

function getCurrentFrisbeeDesign(): FrisbeeDesign {
  return (
    frisbeeDesigns.find((d) => d.id === selectedFrisbeeId) || frisbeeDesigns[0]
  );
}

// ============================================================
// AUDIO
// ============================================================

function playSound(
  id: string,
  loop = false,
  volume = 1.0,
): { source: AudioBufferSourceNode; gainNode: GainNode } | null {
  if (isMuted) return null;
  if (!audioContext || !audioBuffers[id]) return null;
  if (audioContext.state === "suspended") audioContext.resume();

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  source.buffer = audioBuffers[id];
  source.loop = loop;
  gainNode.gain.value = volume;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(0);
  return { source, gainNode };
}

function startMusic(): void {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch (_) {
      /* ignore */
    }
    musicSource = null;
  }
  if (!audioContext || musicBuffers.length === 0) return;
  if (isMuted) return;
  if (audioContext.state === "suspended") audioContext.resume();

  const buffer = musicBuffers[currentMusicTrack % musicBuffers.length];
  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  source.buffer = buffer;
  source.loop = false;
  gainNode.gain.value = 0.3;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(0);
  musicSource = source;

  // When this track ends, play the other one
  source.onended = () => {
    if (musicSource === source) {
      currentMusicTrack++;
      startMusic();
    }
  };
}

function stopMusic(): void {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch (_) {
      /* ignore */
    }
    musicSource = null;
  }
}

async function loadMusicBuffers(): Promise<void> {
  if (!audioContext) return;
  const promises = MUSIC_URLS.map(async (url) => {
    try {
      const response = await fetch(url);
      const arrayBuf = await response.arrayBuffer();
      return await audioContext!.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn("Failed to load music track:", url, e);
      return null;
    }
  });
  const results = await Promise.all(promises);
  musicBuffers = results.filter((b): b is AudioBuffer => b !== null);
  console.log(`[Music] Loaded ${musicBuffers.length} tracks`);
}

// ---- Synthesised SFX (no external files needed) ----

function playCatchSfx(): void {
  if (isMuted || !audioContext) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime;

  // Bright, short chime – two layered sine tones
  const g = audioContext.createGain();
  g.connect(audioContext.destination);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  const o1 = audioContext.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(880, now);
  o1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
  o1.connect(g);
  o1.start(now);
  o1.stop(now + 0.35);

  const g2 = audioContext.createGain();
  g2.connect(audioContext.destination);
  g2.gain.setValueAtTime(0.1, now + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  const o2 = audioContext.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(1320, now + 0.05);
  o2.connect(g2);
  o2.start(now + 0.05);
  o2.stop(now + 0.3);
}

function playCollisionSfx(): void {
  if (isMuted || !audioContext) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime;

  // Soft thud — low sine + filtered noise
  const g = audioContext.createGain();
  g.connect(audioContext.destination);
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  const o = audioContext.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(60, now + 0.2);
  o.connect(g);
  o.start(now);
  o.stop(now + 0.25);

  // Noise burst for texture
  const bufferSize = audioContext.sampleRate * 0.15;
  const noiseBuffer = audioContext.createBuffer(
    1,
    bufferSize,
    audioContext.sampleRate,
  );
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);

  const ng = audioContext.createGain();
  ng.gain.setValueAtTime(0.12, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter);
  filter.connect(ng);
  ng.connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

function playThrowSfx(): void {
  if (isMuted || !audioContext) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime;

  // Quick soft whoosh — filtered noise sweep
  const bufferSize = audioContext.sampleRate * 0.2;
  const noiseBuffer = audioContext.createBuffer(
    1,
    bufferSize,
    audioContext.sampleRate,
  );
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.12);
  filter.Q.value = 2;

  const g = audioContext.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  noise.connect(filter);
  filter.connect(g);
  g.connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + 0.2);
}

// ============================================================
// THREE.JS SCENE INIT
// ============================================================

function initScene(): void {
  let canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  let hadPreviousRenderer = false;

  // Dispose previous renderer to free WebGL context (critical for HMR / reload)
  if (renderer) {
    hadPreviousRenderer = true;
    renderer.forceContextLoss();
    renderer.dispose();
  }
  // Also clean up any stale renderer from a previous HMR cycle
  const staleRenderer = (window as any).__frisbee_renderer as
    | THREE.WebGLRenderer
    | undefined;
  if (staleRenderer && staleRenderer !== renderer) {
    hadPreviousRenderer = true;
    try {
      staleRenderer.forceContextLoss();
      staleRenderer.dispose();
    } catch (_) {
      /* already lost */
    }
  }

  // After forceContextLoss the browser returns the same dead context for
  // the old canvas element. Replace the canvas so Three.js gets a fresh one.
  if (hadPreviousRenderer && canvas) {
    const parent = canvas.parentElement;
    const newCanvas = document.createElement("canvas");
    newCanvas.id = "game-canvas";
    // Copy over style / class from old canvas
    newCanvas.className = canvas.className;
    newCanvas.style.cssText = canvas.style.cssText;
    parent?.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
  }

  scene = new THREE.Scene();

  // Sky sphere with gradient shader
  const skyGeometry = new THREE.SphereGeometry(400, 16, 16);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      void main() {
        float h = normalize(vPosition).y;
        vec3 topColor = vec3(0.18, 0.45, 0.96);       // deep cartoon blue
        vec3 midColor = vec3(0.40, 0.68, 0.98);       // bright sky blue
        vec3 horizonColor = vec3(0.70, 0.88, 1.0);    // light blue horizon
        float midFactor = smoothstep(-0.1, 0.35, h);
        float topFactor = smoothstep(0.25, 0.85, h);
        vec3 skyColor = mix(horizonColor, midColor, midFactor);
        skyColor = mix(skyColor, topColor, topFactor);
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `,
  });
  skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  (skyMesh as any).userData.isSky = true;
  scene.add(skyMesh);

  createCartoonClouds();

  scene.fog = new THREE.Fog(0xb3e0ff, 180, 380);

  // Camera (initial aspect; resizeRenderer will update it)
  camera = new THREE.PerspectiveCamera(68, DESIGN_W / DESIGN_H, 0.1, 1000);
  camera.position.set(0, 16, -10);
  camera.lookAt(0, 0, 10);

  // Renderer — sized to actual container, not fixed pixels
  // NOTE: We no longer pre-test WebGL with canvas.getContext() because the
  // browser only allows ONE context per canvas. If we grab one first, Three.js
  // receives the same (potentially lost) context and crashes. Instead we let
  // Three.js create the context directly and catch failures.
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e1) {
    try {
      // Retry without anti-alias (lower GPU demand)
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      });
    } catch (_e2) {
      // WebGL not available at all — show error to user
      const msg = document.createElement("div");
      msg.style.cssText =
        "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#fff;font-family:Inter,sans-serif;font-size:18px;text-align:center;padding:24px;z-index:9999";
      msg.innerHTML =
        "WebGL is not available.<br>Please enable hardware acceleration in your browser settings and reload.";
      document.body.appendChild(msg);
      throw new Error("WebGL not available — cannot create renderer");
    }
  }
  // Keep a window-level reference so future HMR can clean it up
  (window as any).__frisbee_renderer = renderer;

  // Initial sizing + listen for future resizes
  resizeRenderer();
  window.addEventListener("resize", resizeRenderer);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0, 20, 10);
  scene.add(dirLight);

  // Ground with artificial grass texture
  const grassCanvas = document.createElement("canvas");
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const grassCtx = grassCanvas.getContext("2d")!;
  grassCtx.fillStyle = window.gameConfig.fieldColor || "#2E9B3E";
  grassCtx.fillRect(0, 0, 512, 512);

  const stripeWidth = 64;
  const numStripes = Math.ceil(512 / stripeWidth);
  for (let i = 0; i < numStripes; i++) {
    if (i % 2 === 0) {
      grassCtx.fillStyle = "rgba(0, 0, 0, 0.08)";
      grassCtx.fillRect(0, i * stripeWidth, 512, stripeWidth);
    }
  }
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    grassCtx.fillStyle =
      Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
    grassCtx.fillRect(x, y, 2, 3);
  }

  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(15, 100);

  const groundGeometry = new THREE.PlaneGeometry(360, 10000);
  const groundMaterial = new THREE.MeshLambertMaterial({
    map: grassTexture,
    emissive: 0x1a5c1a,
    emissiveIntensity: 0.25,
  });
  groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.position.z = 10;
  groundMesh.receiveShadow = false;
  scene.add(groundMesh);

  createStadiumBackground();
  createCharacters();
  createFrisbee();
  createBaseMarkers();
  generateObstacles();
}

// ============================================================
// CARTOON CLOUDS
// ============================================================

function createCartoonClouds(): void {
  const cloudMaterials = [0xffffff, 0xf0f8ff, 0xe6f2ff].map(
    (color) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        fog: false,
      }),
  );
  const puffGeometries = [5, 6, 7, 8].map(
    (r) => new THREE.SphereGeometry(r, 8, 8),
  );

  for (let i = 0; i < 12; i++) {
    const cloudGroup = new THREE.Group();
    const numPuffs = 4 + Math.floor(Math.random() * 3);
    const cloudMaterial =
      cloudMaterials[Math.floor(Math.random() * cloudMaterials.length)];

    for (let j = 0; j < numPuffs; j++) {
      const puff = new THREE.Mesh(
        puffGeometries[Math.floor(Math.random() * puffGeometries.length)],
        cloudMaterial,
      );
      puff.position.x = (j - numPuffs / 2) * 4;
      puff.position.y = Math.sin(j) * 2.5;
      puff.position.z = (Math.random() - 0.5) * 3;
      cloudGroup.add(puff);
    }

    const row = Math.floor(i / 4);
    const col = i % 4;
    cloudGroup.position.x = (col - 1.5) * 40;
    cloudGroup.position.y = 50 + Math.random() * 30;
    cloudGroup.position.z = row * 50 + Math.random() * 20;
    cloudGroup.rotation.y = Math.random() * Math.PI * 2;
    cloudGroup.userData.isCloud = true;
    cloudGroup.userData.baseZOffset = cloudGroup.position.z - 10;
    scene.add(cloudGroup);
    stadiumElements.push(cloudGroup);
  }
}

// ============================================================
// FIELD MARKINGS
// ============================================================

function createFieldMarkings(): void {
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function createLine(w: number, l: number, x: number, z: number): void {
    const geometry = new THREE.PlaneGeometry(w, l);
    const line = new THREE.Mesh(geometry, lineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, z);
    line.userData.isStructure = true;
    scene.add(line);
    stadiumElements.push(line);
  }

  createLine(0.15, 10000, -12, 10);
  createLine(0.15, 10000, 12, 10);
}

// ============================================================
// LOW POLY TREE
// ============================================================

function createLowPolyTree(
  x: number,
  y: number,
  z: number,
  scale = 1,
): THREE.Group {
  const treeGroup = new THREE.Group();
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const foliageMaterial = new THREE.MeshLambertMaterial({
    color: 0x2e7d32,
    emissive: 0x1b5e20,
    emissiveIntensity: 0.1,
  });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4 * scale, 0.5 * scale, 4 * scale, 6),
    trunkMaterial,
  );
  trunk.position.y = 2 * scale;
  trunk.castShadow = false;
  treeGroup.add(trunk);

  const coneGeo = new THREE.ConeGeometry(2.5 * scale, 5 * scale, 6);
  const f1 = new THREE.Mesh(coneGeo, foliageMaterial);
  f1.position.y = 5.5 * scale;
  f1.castShadow = false;
  treeGroup.add(f1);
  const f2 = new THREE.Mesh(coneGeo, foliageMaterial);
  f2.position.y = 7.5 * scale;
  f2.scale.set(0.7, 0.7, 0.7);
  f2.castShadow = false;
  treeGroup.add(f2);
  const f3 = new THREE.Mesh(coneGeo, foliageMaterial);
  f3.position.y = 9 * scale;
  f3.scale.set(0.5, 0.5, 0.5);
  f3.castShadow = false;
  treeGroup.add(f3);

  treeGroup.position.set(x, y, z);
  treeGroup.userData.isStructure = true;
  treeGroup.userData.baseZOffset = z - 10;
  return treeGroup;
}

// ============================================================
// STADIUM BACKGROUND
// ============================================================

function createStadiumBackground(): void {
  stadiumElements.forEach((el) => scene.remove(el));
  stadiumElements = [];

  const bleacherMaterial = new THREE.MeshLambertMaterial({
    color: 0xcccccc,
    emissive: 0xcccccc,
    emissiveIntensity: 0.3,
  });
  const wallMaterial = new THREE.MeshLambertMaterial({
    color: 0x888888,
    emissive: 0x888888,
    emissiveIntensity: 0.3,
  });
  const roofMaterial = new THREE.MeshLambertMaterial({
    color: 0x444444,
    emissive: 0x444444,
    emissiveIntensity: 0.3,
  });
  const poleMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
  });
  const headMaterial = new THREE.MeshLambertMaterial({
    color: 0xffdbac,
    emissive: 0xffdbac,
    emissiveIntensity: 0.3,
  });

  const bleacherGeometry = new THREE.BoxGeometry(1.2, 0.6, 400);
  const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.6);
  const headGeometry = new THREE.SphereGeometry(0.35, 6, 6);

  const standDistance = 14;
  const numRows = 12;
  const rowHeight = 0.6;
  const rowWidth = 400;

  const shirtColors = [
    0xff0000, 0x0000ff, 0xffff00, 0x00ff00, 0xff00ff, 0x00ffff, 0xff8800,
    0x8800ff, 0xffffff, 0xff69b4, 0xff1493, 0x32cd32, 0x1e90ff, 0xffd700,
    0xff4500,
  ];
  const shirtMaterials = shirtColors.map(
    (c) =>
      new THREE.MeshLambertMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.3,
      }),
  );

  for (let side = 0; side < 2; side++) {
    const xSign = side === 0 ? -1 : 1;

    for (let row = 0; row < numRows; row++) {
      const rowX = xSign * (standDistance + row * 0.5);
      const rowY = row * rowHeight;
      const rowZ = 10;

      const bleacher = new THREE.Mesh(bleacherGeometry, bleacherMaterial);
      bleacher.position.set(rowX, rowY, rowZ);
      bleacher.userData.isStructure = true;
      scene.add(bleacher);
      stadiumElements.push(bleacher);

      const peoplePerRow = 26;
      const spacing = rowWidth / peoplePerRow;

      for (let p = 0; p < peoplePerRow; p++) {
        if (Math.random() < 0.08) continue;
        const personZ =
          -50 + p * spacing + (Math.random() - 0.5) * spacing * 0.6;
        const xOffset = (Math.random() - 0.5) * 0.4;
        const personX = rowX + xOffset;
        const yOffset = (Math.random() - 0.5) * 0.15;
        const personY = rowY + rowHeight / 2 + yOffset;
        const shirtMaterial =
          shirtMaterials[Math.floor(Math.random() * shirtMaterials.length)];
        const sv = 0.9 + Math.random() * 0.2;

        const body = new THREE.Mesh(bodyGeometry, shirtMaterial);
        body.scale.set(sv, sv, sv);
        body.position.set(personX, personY + 0.7 * sv, personZ);
        body.userData.isStructure = true;
        body.userData.baseZOffset = personZ - rowZ;
        body.castShadow = false;
        scene.add(body);
        stadiumElements.push(body);

        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.scale.set(sv, sv, sv);
        head.position.set(personX, personY + 1.5 * sv, personZ);
        head.userData.isStructure = true;
        head.userData.baseZOffset = personZ - rowZ;
        head.castShadow = false;
        scene.add(head);
        stadiumElements.push(head);
      }
    }

    const wallGeometry = new THREE.BoxGeometry(
      0.3,
      numRows * rowHeight + 2,
      rowWidth,
    );
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(
      xSign * (standDistance + numRows * 0.5 + 1),
      (numRows * rowHeight) / 2,
      10,
    );
    wall.userData.isStructure = true;
    wall.castShadow = false;
    scene.add(wall);
    stadiumElements.push(wall);

    const roofGeometry = new THREE.BoxGeometry(2, 0.3, rowWidth);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(
      xSign * (standDistance + numRows * 0.5),
      numRows * rowHeight + 2,
      10,
    );
    roof.userData.isStructure = true;
    roof.castShadow = false;
    scene.add(roof);
    stadiumElements.push(roof);
  }

  // Decorative flags
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
  const flagGeo = new THREE.BoxGeometry(0.05, 0.8, 1.2);
  const flagColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00];
  const flagMats = flagColors.map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );

  for (let i = 0; i < 4; i++) {
    const flagZ = -40 + i * 30;
    const flagMat = flagMats[i % flagMats.length];
    for (let side = 0; side < 2; side++) {
      const xSign = side === 0 ? -1 : 1;
      const flagX = xSign * (standDistance + numRows * 0.5 + 1.5);

      const pole = new THREE.Mesh(poleGeo, poleMaterial);
      pole.position.set(flagX, numRows * rowHeight + 3.5, flagZ);
      pole.userData.isStructure = true;
      pole.userData.baseZOffset = flagZ - 10;
      pole.castShadow = false;
      scene.add(pole);
      stadiumElements.push(pole);

      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(flagX + xSign * 0.5, numRows * rowHeight + 4.5, flagZ);
      flag.userData.isStructure = true;
      flag.userData.baseZOffset = flagZ - 10;
      flag.castShadow = false;
      scene.add(flag);
      stadiumElements.push(flag);
    }
  }

  // Trees above bleachers
  const treeX = standDistance + numRows * 0.5 + 0.5;
  const roofHeight = numRows * rowHeight + 2;
  const treeBaseY = roofHeight - 2;
  const treesPerSide = 15;
  const treeSpacing = rowWidth / treesPerSide;

  for (let i = 0; i < treesPerSide; i++) {
    const treeZ = -50 + i * treeSpacing;
    const rs = 0.8 + Math.random() * 0.4;
    const ro = (Math.random() - 0.5) * 1;

    const leftTree = createLowPolyTree(-treeX + ro, treeBaseY, treeZ, rs);
    scene.add(leftTree);
    stadiumElements.push(leftTree);

    const rightTree = createLowPolyTree(treeX + ro, treeBaseY, treeZ, rs);
    scene.add(rightTree);
    stadiumElements.push(rightTree);
  }

  createFieldMarkings();
}

// ============================================================
// SHARED FRISBEE STAR TEXTURE
// ============================================================

function createWallStripeTexture(w: number, h: number): THREE.CanvasTexture {
  const pxPerUnit = 64;
  const cw = Math.round(w * pxPerUnit);
  const ch = Math.round(h * pxPerUnit);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d")!;

  // Fill white base
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  // Diagonal pink stripes (thick, ~45 degrees)
  const stripeW = 38; // stripe width in px
  const gap = 38; // gap between stripes
  const step = stripeW + gap;
  ctx.fillStyle = "#ff4da6";
  // Cover enough range for diagonal
  const range = cw + ch;
  for (let off = -range; off < range; off += step) {
    ctx.beginPath();
    ctx.moveTo(off, 0);
    ctx.lineTo(off + stripeW, 0);
    ctx.lineTo(off + stripeW - ch, ch);
    ctx.lineTo(off - ch, ch);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createFrisbeeStarTexture(): THREE.CanvasTexture {
  const texC = document.createElement("canvas");
  texC.width = 256;
  texC.height = 256;
  const tx = texC.getContext("2d")!;
  const cx = 128,
    cy = 128;
  // Solid purple background
  tx.beginPath();
  tx.arc(cx, cy, 126, 0, Math.PI * 2);
  tx.fillStyle = "#6C63FF";
  tx.fill();
  // Yellow ring border
  tx.beginPath();
  tx.arc(cx, cy, 110, 0, Math.PI * 2);
  tx.strokeStyle = "#FFD93D";
  tx.lineWidth = 6;
  tx.stroke();
  // Bold white 5-point star
  tx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = cx + Math.cos(outerAngle) * 55;
    const oy = cy + Math.sin(outerAngle) * 55;
    const ix = cx + Math.cos(innerAngle) * 22;
    const iy = cy + Math.sin(innerAngle) * 22;
    if (i === 0) tx.moveTo(ox, oy);
    else tx.lineTo(ox, oy);
    tx.lineTo(ix, iy);
  }
  tx.closePath();
  tx.fillStyle = "#FFFFFF";
  tx.fill();
  tx.strokeStyle = "#FFD93D";
  tx.lineWidth = 3;
  tx.stroke();
  return new THREE.CanvasTexture(texC);
}

// ============================================================
// CREATE CHARACTERS (thrower = floating frisbee, receiver = pole with flag)
// ============================================================

function createCharacters(): void {
  // THROWER: Floating Frisbee with glow
  const throwerGroup = new THREE.Group();

  // Multi-material disc: side=purple, top/bottom=star texture (no z-fighting)
  const discGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.1, 32);
  const sideMat = new THREE.MeshLambertMaterial({
    color: 0x6c63ff,
    emissive: 0x6c63ff,
    emissiveIntensity: 0.15,
  });
  const starTex = createFrisbeeStarTexture();
  const capMat = new THREE.MeshBasicMaterial({ map: starTex });
  const disc = new THREE.Mesh(discGeo, [sideMat, capMat, capMat]);
  disc.castShadow = false;
  throwerGroup.add(disc);

  // Outer rim — creamy white
  const rimGeo = new THREE.TorusGeometry(0.89, 0.06, 12, 32);
  const rimMat = new THREE.MeshLambertMaterial({
    color: 0xfff5e4,
    emissive: 0xfff5e4,
    emissiveIntensity: 0.2,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  throwerGroup.add(rim);

  // Soft glow ring — purple
  const glowGeo = new THREE.TorusGeometry(1.06, 0.08, 8, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x6c63ff,
    transparent: true,
    opacity: 0.2,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = Math.PI / 2;
  throwerGroup.add(glow);
  throwerGroup.userData.glow = glow;
  throwerGroup.userData.baseY = 2.0;

  throwerGroup.position.set(
    gameState.throwerPos.x,
    2.0,
    gameState.throwerPos.z,
  );
  scene.add(throwerGroup);
  throwerSprite = throwerGroup;

  // RECEIVER: Pole with waving flag
  const receiverGroup = new THREE.Group();

  const flagW = 2.2,
    flagH = 2.2;
  const poleHeight = flagH + 4;
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 8);
  const poleMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.1,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = poleHeight / 2;
  pole.castShadow = false;
  receiverGroup.add(pole);

  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 16, 10);
  const logoTexture = new THREE.TextureLoader().load(
    "https://remix.gg/blob/bc448687-3c6a-4d23-8ae6-cb80793ea667/logo-tWUf4VMivC-LsnBT6yvPuSv2dGwErmc3NtKVz4DVw.webp?nqMd",
  );
  const flagMat = new THREE.MeshBasicMaterial({
    map: logoTexture,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(flagW / 2, poleHeight - flagH / 2, 0);
  flagMesh.castShadow = false;
  receiverGroup.add(flagMesh);

  receiverGroup.userData.flag = flagMesh;
  receiverGroup.userData.flagGeometry = flagGeo;
  receiverGroup.userData.flagOriginalPositions = [];
  const positions = flagGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    receiverGroup.userData.flagOriginalPositions.push({
      x: positions.getX(i),
      y: positions.getY(i),
      z: positions.getZ(i),
    });
  }

  receiverGroup.position.copy(gameState.receiverPos);
  scene.add(receiverGroup);
  receiverSprite = receiverGroup;
}

// ============================================================
// CREATE FRISBEE
// ============================================================

function createFrisbee(): void {
  const frisbeeGroup = new THREE.Group();

  // Multi-material disc: side=purple, top/bottom=star texture (no z-fighting)
  const discGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.1, 32);
  const sideMat = new THREE.MeshLambertMaterial({
    color: 0x6c63ff,
    emissive: 0x6c63ff,
    emissiveIntensity: 0.15,
  });
  const starTex = createFrisbeeStarTexture();
  const capMat = new THREE.MeshBasicMaterial({ map: starTex });
  const disc = new THREE.Mesh(discGeo, [sideMat, capMat, capMat]);
  disc.castShadow = false;
  frisbeeGroup.add(disc);

  // Outer rim — creamy white
  const rimGeo = new THREE.TorusGeometry(0.89, 0.06, 12, 32);
  const rimMat = new THREE.MeshLambertMaterial({
    color: 0xfff5e4,
    emissive: 0xfff5e4,
    emissiveIntensity: 0.2,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  frisbeeGroup.add(rim);

  frisbeeGroup.position.copy(gameState.frisbeePos);

  scene.add(frisbeeGroup);
  frisbeeMesh = frisbeeGroup;
}

// ============================================================
// TRAIL EFFECT
// ============================================================

function updateTrail(): void {
  if (gameState.phase !== "flying") {
    trailMeshes.forEach((m) => {
      if (m) m.visible = false;
    });
    return;
  }

  const minDist = 0.35;
  let shouldAdd = false;
  if (frisbeeTrail.length === 0) {
    shouldAdd = true;
  } else {
    shouldAdd =
      gameState.frisbeePos.distanceTo(
        frisbeeTrail[frisbeeTrail.length - 1].position,
      ) >= minDist;
  }
  if (shouldAdd) {
    frisbeeTrail.push({
      position: gameState.frisbeePos.clone(),
      rotation: gameState.frisbeeRotation,
      age: 0,
    });
  }

  if (frisbeeTrail.length > 35) frisbeeTrail.shift();
  frisbeeTrail.forEach((s) => {
    s.age += 0.035;
  });
  updateTrailMeshes();
}

function updateTrailMeshes(): void {
  if (frisbeeTrail.length < 2) {
    trailMeshes.forEach((m) => {
      if (m) m.visible = false;
    });
    return;
  }

  const gradientColors = [
    new THREE.Color(0xff00ff),
    new THREE.Color(0xff0080),
    new THREE.Color(0xff4500),
    new THREE.Color(0xffd700),
    new THREE.Color(0x00ff88),
    new THREE.Color(0x00ffff),
    new THREE.Color(0x0088ff),
  ];
  const particleGeo = new THREE.SphereGeometry(1, 8, 8);

  for (let i = 0; i < frisbeeTrail.length; i++) {
    const seg = frisbeeTrail[i];
    if (!seg) continue;
    const alpha = 1 - seg.age;
    if (alpha <= 0 || i === frisbeeTrail.length - 1) continue;

    const t = i / Math.max(1, frisbeeTrail.length - 1);
    const ci = t * (gradientColors.length - 1);
    const lo = Math.floor(ci);
    const hi = Math.min(lo + 1, gradientColors.length - 1);
    const particleColor = new THREE.Color();
    particleColor.lerpColors(gradientColors[lo], gradientColors[hi], ci - lo);

    const sizeMul = Math.min(1, seg.age * 5);

    if (i < trailMeshes.length && trailMeshes[i]) {
      const p = trailMeshes[i];
      p.visible = true;
      const s = 0.55 * alpha * sizeMul;
      p.scale.set(s, s, s);
      (p.material as any).color.copy(particleColor);
      if ((p.material as any).emissive)
        (p.material as any).emissive.copy(particleColor);
      (p.material as any).opacity = alpha * 0.95;
      p.position.copy(seg.position);
    } else {
      const mat = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: alpha * 0.95,
        depthWrite: false,
      });
      const p = new THREE.Mesh(particleGeo, mat);
      p.renderOrder = -1;
      scene.add(p);
      trailMeshes.push(p);
      const s = 0.55 * alpha * sizeMul;
      p.scale.set(s, s, s);
      p.position.copy(seg.position);
    }
  }

  for (let i = frisbeeTrail.length; i < trailMeshes.length; i++) {
    if (trailMeshes[i]) trailMeshes[i].visible = false;
  }
}

function clearTrail(): void {
  frisbeeTrail = [];
  trailMeshes.forEach((m) => {
    m.visible = false;
  });
}

// ============================================================
// FIREWORKS & DESTRUCTION PARTICLES
// ============================================================

function spawnFireworks(position: THREE.Vector3): void {
  const colors = [
    0xff1493, 0xffd700, 0x00ffff, 0xff69b4, 0xffff00, 0xff00ff, 0x00ff88,
    0xff8800,
  ];
  const sharedGeo = new THREE.SphereGeometry(0.15, 4, 4);
  for (let i = 0; i < 20; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 8 + Math.random() * 6;
    const vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
    );
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(sharedGeo, mat);
    mesh.position.copy(position);
    scene.add(mesh);
    fireworksParticles.push({
      mesh,
      velocity: vel,
      lifetime: 0,
      maxLifetime: 1.5 + Math.random() * 0.5,
      initialColor: color,
      trail: [],
    });
  }
}

function spawnDestructionParticles(position: THREE.Vector3): void {
  const colors = [0xff1493, 0xffd700, 0xff8c00, 0xff6347, 0xffffff];
  const sharedGeo = new THREE.SphereGeometry(0.15, 4, 4);
  for (let i = 0; i < 15; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 2 + ((Math.random() - 0.5) * Math.PI) / 2;
    const speed = 6 + Math.random() * 8;
    const vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
    );
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(sharedGeo, mat);
    mesh.position.copy(position);
    scene.add(mesh);
    fireworksParticles.push({
      mesh,
      velocity: vel,
      lifetime: 0,
      maxLifetime: 0.8 + Math.random() * 0.4,
      initialColor: color,
      trail: [],
    });
  }
}

function updateFireworks(deltaTime: number): void {
  const _grav = new THREE.Vector3();
  const _vel = new THREE.Vector3();
  for (let i = fireworksParticles.length - 1; i >= 0; i--) {
    const p = fireworksParticles[i];
    p.lifetime += deltaTime;
    if (p.lifetime >= p.maxLifetime) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      fireworksParticles.splice(i, 1);
      continue;
    }
    _grav.set(0, -15 * deltaTime, 0);
    p.velocity.add(_grav);
    _vel.copy(p.velocity).multiplyScalar(deltaTime);
    p.mesh.position.add(_vel);
    const lr = p.lifetime / p.maxLifetime;
    (p.mesh.material as any).opacity = 1 - lr;
    const sc = 1 - lr * 0.5;
    p.mesh.scale.set(sc, sc, sc);
  }
}

// ============================================================
// BASE MARKERS
// ============================================================

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).geometry)
      (child as THREE.Mesh).geometry.dispose();
    const mat = (child as THREE.Mesh).material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  });
}

function createBaseMarkers(): void {
  baseMarkers.forEach((m) => {
    scene.remove(m);
    disposeObject(m);
  });
  baseMarkers = [];
  baseLines.forEach((l) => {
    scene.remove(l);
    disposeObject(l);
  });
  baseLines = [];

  const baseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const tb = new THREE.Mesh(baseGeo, baseMat);
  tb.position.set(gameState.throwerPos.x, 0.05, gameState.throwerPos.z);
  tb.receiveShadow = false;
  scene.add(tb);
  baseMarkers.push(tb);

  const rb = new THREE.Mesh(baseGeo, baseMat);
  rb.position.set(gameState.receiverPos.x, 0.05, gameState.receiverPos.z);
  rb.receiveShadow = false;
  scene.add(rb);
  baseMarkers.push(rb);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tlGeo = new THREE.PlaneGeometry(24, 0.15);
  const tl = new THREE.Mesh(tlGeo, lineMat);
  tl.rotation.x = -Math.PI / 2;
  tl.position.set(0, 0.02, gameState.throwerPos.z);
  scene.add(tl);
  baseLines.push(tl);

  const rlGeo = new THREE.PlaneGeometry(24, 0.15);
  const rl = new THREE.Mesh(rlGeo, lineMat);
  rl.rotation.x = -Math.PI / 2;
  rl.position.set(0, 0.02, gameState.receiverPos.z);
  scene.add(rl);
  baseLines.push(rl);
}

// ============================================================
// RING MESH (multiplier collectible)
// ============================================================

function createRingMesh(radius: number): THREE.Group {
  const group = new THREE.Group();

  // Main torus ring — bright golden neon
  const torusGeo = new THREE.TorusGeometry(radius, 0.15, 16, 48);
  const torusMat = new THREE.MeshPhongMaterial({
    color: 0xffcc00,
    emissive: 0xff8800,
    emissiveIntensity: 0.7,
    specular: 0xffffff,
    shininess: 120,
    transparent: true,
    opacity: 0.95,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  group.add(torus);

  // Inner neon glow ring (warm white)
  const innerGeo = new THREE.TorusGeometry(radius - 0.04, 0.07, 8, 48);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffee88,
    transparent: true,
    opacity: 0.6,
  });
  const innerRing = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerRing);

  // Outer soft glow ring (wider, warm)
  const outerGeo = new THREE.TorusGeometry(radius + 0.08, 0.1, 8, 48);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.25,
  });
  const outerRing = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerRing);

  // Orbiting particles (6 small glowing spheres)
  const orbGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const particleColors = [
    0xffee44, 0xff6600, 0xffcc00, 0xffee44, 0xff6600, 0xffcc00,
  ];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const orbMat = new THREE.MeshBasicMaterial({
      color: particleColors[i],
      transparent: true,
      opacity: 0.85,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    orb.userData.orbitAngle = angle;
    orb.userData.orbitRadius = radius;
    group.add(orb);
  }

  // Center sparkle — diamond shape
  const sparkleGeo = new THREE.OctahedronGeometry(0.15, 0);
  const sparkleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });
  const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
  sparkle.userData.isSparkle = true;
  group.add(sparkle);

  return group;
}

// ============================================================
// OBSTACLES
// ============================================================

function generateObstacles(): void {
  poles.forEach((p) => {
    scene.remove(p.mesh);
    disposeObject(p.mesh);
  });
  poles = [];

  walls.forEach((w) => {
    scene.remove(w.mesh);
    disposeObject(w.mesh);
  });
  walls = [];

  rings.forEach((r) => {
    scene.remove(r.mesh);
    disposeObject(r.mesh);
  });
  rings = [];

  const config = window.gameConfig;
  const baseDistance = config.baseDistance || 28;

  // Total obstacle slots (poles + walls combined)
  let totalSlots: number;
  if (gameState.score === 0) {
    totalSlots = 1;
  } else {
    totalSlots = Math.min(6, 2 + Math.floor((gameState.score - 1) / 3));
  }
  const poleSpeed =
    (config.poleSpeedMultiplier || 1) * (1 + gameState.score * 0.1);
  gameState.poleCount = totalSlots;
  gameState.poleSpeed = poleSpeed;

  const obstacleColor = 0x8b5cf6;
  const baseColor = 0xffd700;

  // Decide which slots are walls vs poles.
  // Walls only appear from score >= 3, and never two walls in a row.
  const slotTypes: ("pole" | "wall")[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const canBeWall =
      gameState.score >= 3 &&
      (i === 0 || slotTypes[i - 1] !== "wall") && // no consecutive walls
      Math.random() < 0.35; // ~35% chance per eligible slot
    slotTypes.push(canBeWall ? "wall" : "pole");
  }

  // Pauser logic (only for pole slots)
  const poleIndices = slotTypes
    .map((t, i) => (t === "pole" ? i : -1))
    .filter((i) => i >= 0);
  let numPausers = 0;
  if (poleIndices.length >= 3) {
    numPausers = Math.max(1, Math.floor(poleIndices.length * 0.4));
  }
  const pauserSet = new Set<number>();
  while (pauserSet.size < numPausers && pauserSet.size < poleIndices.length) {
    pauserSet.add(poleIndices[Math.floor(Math.random() * poleIndices.length)]);
  }

  for (let i = 0; i < totalSlots; i++) {
    const zPos =
      gameState.throwerPos.z + (baseDistance * (i + 1)) / (totalSlots + 1);

    if (slotTypes[i] === "wall") {
      // --- WALL (gate) ---
      const wallWidth = 24;
      const wallHeight = 4.5;
      const wallDepth = 0.5;
      const darkPink = 0xd6006e;
      const useSplit = gameState.score >= 6 && Math.random() < 0.5;

      if (useSplit) {
        // SPLIT WALL: 4 segments that alternate up/down
        const segCount = 4;
        const segWidth = wallWidth / segCount;
        const wg = new THREE.Group();
        const segments: THREE.Group[] = [];

        for (let s = 0; s < segCount; s++) {
          const sg = new THREE.Group();

          const segW = segWidth - 0.15;
          const boxGeo = new THREE.BoxGeometry(segW, wallHeight, wallDepth);
          const stripeTex = createWallStripeTexture(segW, wallHeight);
          const boxMat = new THREE.MeshLambertMaterial({ map: stripeTex });
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.castShadow = false;
          sg.add(box);

          // Top dark pink bar
          const topGeo = new THREE.BoxGeometry(
            segWidth - 0.05,
            0.35,
            wallDepth + 0.1,
          );
          const topMat = new THREE.MeshLambertMaterial({
            color: darkPink,
            emissive: darkPink,
            emissiveIntensity: 0.25,
          });
          const topBar = new THREE.Mesh(topGeo, topMat);
          topBar.position.y = wallHeight / 2 + 0.15;
          sg.add(topBar);

          // Position each segment along X
          const xOffset = -wallWidth / 2 + segWidth / 2 + s * segWidth;
          sg.position.x = xOffset;
          wg.add(sg);
          segments.push(sg);
        }

        wg.position.set(0, -wallHeight, zPos);
        scene.add(wg);

        walls.push({
          mesh: wg,
          maxY: 2.0 + Math.random() * 1.5,
          speed: 0.8 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          width: wallWidth,
          height: wallHeight,
          isSplit: true,
          segments,
        });
      } else {
        // SOLID WALL
        const wg = new THREE.Group();
        const boxGeo = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
        const stripeTex = createWallStripeTexture(wallWidth, wallHeight);
        const boxMat = new THREE.MeshLambertMaterial({ map: stripeTex });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.castShadow = false;
        wg.add(box);

        // Top dark pink bar
        const topGeo = new THREE.BoxGeometry(
          wallWidth + 0.1,
          0.35,
          wallDepth + 0.1,
        );
        const topMat = new THREE.MeshLambertMaterial({
          color: darkPink,
          emissive: darkPink,
          emissiveIntensity: 0.25,
        });
        const topBar = new THREE.Mesh(topGeo, topMat);
        topBar.position.y = wallHeight / 2 + 0.15;
        wg.add(topBar);

        wg.position.set(0, -wallHeight, zPos);
        scene.add(wg);

        walls.push({
          mesh: wg,
          maxY: 2.0 + Math.random() * 1.5,
          speed: 0.8 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          width: wallWidth,
          height: wallHeight,
        });
      }
    } else {
      // --- STACKED SPHERES OBSTACLE ---
      const og = new THREE.Group();

      const sphereCount = 3;
      const sphereRadius = 0.75;
      const squishY = 0.8; // vertical squish factor
      const stackSpacing = sphereRadius * 2 * squishY * 0.85; // overlap slightly
      const totalHeight =
        stackSpacing * (sphereCount - 1) + sphereRadius * 2 * squishY;

      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 14, 10);

      // Slightly different shades for each sphere for depth
      const shades = [0x7c3aed, 0x8b5cf6, 0xa78bfa];

      for (let s = 0; s < sphereCount; s++) {
        const mat = new THREE.MeshLambertMaterial({
          color: shades[s],
          emissive: shades[s],
          emissiveIntensity: 0.15,
        });
        const sphere = new THREE.Mesh(sphereGeo, mat);
        sphere.scale.set(1, squishY, 1); // squish vertically
        sphere.position.y = sphereRadius * squishY + s * stackSpacing;
        sphere.castShadow = false;
        og.add(sphere);
      }

      // Yellow base
      const bg = new THREE.CylinderGeometry(0.8, 0.85, 0.3, 10);
      const bm = new THREE.MeshLambertMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.2,
      });
      const base = new THREE.Mesh(bg, bm);
      base.position.y = 0.15;
      og.add(base);

      const xRange = 18 - gameState.score * 0.2;
      const startX = (Math.random() - 0.5) * xRange;
      og.position.set(startX, 0, zPos);
      scene.add(og);

      poles.push({
        mesh: og,
        baseX: 0,
        range: 10,
        speed: poleSpeed * (0.8 + Math.random() * 0.4),
        phase: Math.random() * Math.PI * 2,
        direction: Math.random() > 0.5 ? 1 : -1,
        canPause: pauserSet.has(i),
        isPaused: false,
        pauseTimer: 0,
        pauseDuration: 1.0,
        lastDirection: 0,
        pauseCooldown: 0,
        pauseCooldownDuration: 2.0,
        pausedPosition: 0,
      });
    }
  }

  // --- RING (multiplier) --- randomly placed, ~40% chance, max 1 per level
  if (gameState.score >= 1 && Math.random() < 0.4) {
    const ringZ =
      gameState.throwerPos.z + baseDistance * (0.3 + Math.random() * 0.4); // between 30%-70% of the way
    const ringX = (Math.random() - 0.5) * 12; // within playable area
    const ringY = 2.0; // match frisbee flight height so it's always collectible
    const ringRadius = 1.4; // big enough for frisbee to pass through

    const ringGroup = createRingMesh(ringRadius);
    ringGroup.position.set(ringX, ringY, ringZ);
    // Face toward the player (rotated to be perpendicular to Z axis)
    ringGroup.rotation.y = 0;
    scene.add(ringGroup);

    rings.push({
      mesh: ringGroup,
      zPos: ringZ,
      xPos: ringX,
      yPos: ringY,
      radius: ringRadius,
      collected: false,
      rotationSpeed: 0.5 + Math.random() * 0.5,
    });
  }
}

// ============================================================
// POLE MOVEMENT
// ============================================================

function updatePoles(deltaTime: number): void {
  const time = performance.now() / 1000;
  poles.forEach((pole) => {
    if (pole.pauseCooldown > 0) pole.pauseCooldown -= deltaTime;

    if (pole.canPause && !pole.isPaused && pole.pauseCooldown <= 0) {
      const sv = Math.sin(time * pole.speed + pole.phase);
      if (Math.abs(sv) < 0.15 && Math.random() < 0.5) {
        pole.isPaused = true;
        pole.pauseTimer = 0;
        pole.lastDirection = sv < 0 ? -1 : 1;
        pole.pausedPosition = pole.mesh.position.x;
      }
    }

    if (pole.isPaused) {
      pole.pauseTimer += deltaTime;
      pole.mesh.position.x = pole.pausedPosition;
      if (pole.pauseTimer >= pole.pauseDuration) {
        pole.isPaused = false;
        pole.pauseCooldown = pole.pauseCooldownDuration;
        pole.phase =
          Math.asin((pole.pausedPosition - pole.baseX) / pole.range) -
          time * pole.speed;
      }
    } else {
      pole.mesh.position.x =
        pole.baseX + Math.sin(time * pole.speed + pole.phase) * pole.range;
    }
  });
}

function updateWalls(): void {
  const time = performance.now() / 1000;
  walls.forEach((wall) => {
    const hiddenY = -wall.height / 2;
    const raisedY = wall.maxY - wall.height / 2;

    if (wall.isSplit && wall.segments) {
      // Split wall: each segment moves independently, alternating direction
      wall.mesh.position.y = 0; // parent stays at ground level
      wall.segments.forEach((seg, idx) => {
        // Even indices (0,2) rise while odd (1,3) sink, then swap
        const phaseOffset = idx % 2 === 0 ? 0 : Math.PI;
        const t =
          (Math.sin(time * wall.speed + wall.phase + phaseOffset) + 1) / 2;
        seg.position.y = hiddenY + t * (raisedY - hiddenY);
      });
    } else {
      // Solid wall: single block rises and falls
      const t = (Math.sin(time * wall.speed + wall.phase) + 1) / 2;
      wall.mesh.position.y = hiddenY + t * (raisedY - hiddenY);
    }
  });
}

// ============================================================
// COLLISION DETECTION
// ============================================================

function checkCollision(): PoleData | WallData | null {
  const fp = gameState.frisbeePos;
  for (const pole of poles) {
    const pp = pole.mesh.position;
    if (Math.abs(fp.z - pp.z) < 0.8) {
      if (fp.y > 0 && fp.y < 5) {
        if (Math.abs(fp.x - pp.x) < 0.6 + 0.7) {
          return pole;
        }
      }
    }
  }
  // Check walls (gate collision — only above ground portion blocks)
  for (const wall of walls) {
    const wp = wall.mesh.position;

    if (wall.isSplit && wall.segments) {
      // Check each segment individually
      const segWidth = wall.width / wall.segments.length;
      for (const seg of wall.segments) {
        const segWorldX = wp.x + seg.position.x;
        const segWorldY = seg.position.y; // parent y is 0 for split walls
        const topEdge = segWorldY + wall.height / 2;
        const bottomEdge = Math.max(0, segWorldY - wall.height / 2);
        if (topEdge <= 0) continue;
        if (
          Math.abs(fp.z - wp.z) < 0.5 + 0.5 &&
          Math.abs(fp.x - segWorldX) < segWidth / 2 + 0.5 &&
          fp.y > bottomEdge - 0.5 &&
          fp.y < topEdge + 0.5
        ) {
          return wall;
        }
      }
    } else {
      // Solid wall collision
      const topEdge = wp.y + wall.height / 2;
      const bottomEdge = Math.max(0, wp.y - wall.height / 2);
      const halfD = 0.5;
      if (topEdge <= 0) continue;
      if (
        Math.abs(fp.z - wp.z) < halfD + 0.5 &&
        fp.y > bottomEdge - 0.5 &&
        fp.y < topEdge + 0.5
      ) {
        return wall;
      }
    }
  }
  return null;
}

function checkCatch(): boolean {
  const fp = gameState.frisbeePos;
  const rp = gameState.receiverPos;
  const catchZoneSizes: Record<string, number> = {
    small: 1.5,
    medium: 2.5,
    large: 3.5,
  };
  const catchRadius =
    catchZoneSizes[window.gameConfig.catchZoneSize || "medium"];
  const dx = fp.x - rp.x;
  const dz = fp.z - rp.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist < catchRadius && fp.y > 0.5 && fp.y < 3;
}

// ============================================================
// RING COLLECTION & ANIMATION
// ============================================================

function checkRingCollection(): void {
  const fp = gameState.frisbeePos;
  const pp = prevFrisbeePos;
  for (const ring of rings) {
    if (ring.collected) continue;
    // Swept Z check: detect if the ring Z plane falls between
    // the previous and current frisbee positions (prevents tunneling
    // when the frisbee moves fast between frames)
    const zMin = Math.min(pp.z, fp.z) - 1.5;
    const zMax = Math.max(pp.z, fp.z) + 1.5;
    const ringInZRange = ring.zPos >= zMin && ring.zPos <= zMax;
    if (ringInZRange) {
      // Interpolate frisbee XY at the ring's Z plane for accurate check
      const zTravel = fp.z - pp.z;
      let interpX: number, interpY: number;
      if (Math.abs(zTravel) > 0.001) {
        const tLerp = (ring.zPos - pp.z) / zTravel;
        const tClamped = Math.max(0, Math.min(1, tLerp));
        interpX = pp.x + (fp.x - pp.x) * tClamped;
        interpY = pp.y + (fp.y - pp.y) * tClamped;
      } else {
        interpX = fp.x;
        interpY = fp.y;
      }
      const dx = interpX - ring.xPos;
      const dy = interpY - ring.yPos;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      if (distFromCenter < ring.radius * 1.2) {
        // Collected!
        ring.collected = true;
        gameState.multiplier++;
        updateMultiplierDisplay();

        // Show multiplier message
        const cd = document.getElementById("combo-display")!;
        cd.textContent = `×${gameState.multiplier}`;
        cd.style.color = "#00e5ff";
        cd.style.textShadow =
          "0 0 20px #00e5ff, 0 0 40px #7c4dff, 0 2px 0 #111, 0 3px 10px rgba(0,0,0,0.9)";
        cd.classList.add("visible");
        setTimeout(() => {
          cd.classList.remove("visible");
          cd.style.color = "#FFD54F";
          cd.style.textShadow = "";
        }, 800);

        // Play catch sound for ring collection
        playCatchSfx();

        // Haptic feedback
        try {
          window.RemixSDK?.hapticFeedback();
        } catch (_) {
          /* ignore */
        }

        // Collection effect - shrink and fade
        ringCollectEffect(ring);
      }
    }
  }
}

function ringCollectEffect(ring: RingData): void {
  const mesh = ring.mesh;
  const startScale = mesh.scale.x;
  const startTime = performance.now();
  const duration = 300;

  function animate() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);

    // Scale up and fade out
    const scale = startScale * (1 + t * 0.5);
    mesh.scale.set(scale, scale, scale);

    mesh.traverse((child) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.Material;
        if (mat.transparent !== undefined) {
          mat.transparent = true;
          mat.opacity = 1 - t;
        }
      }
    });

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(mesh);
      disposeObject(mesh);
    }
  }
  animate();
}

function updateRings(time?: number): void {
  const t = (time || performance.now()) * 0.001;
  for (const ring of rings) {
    if (ring.collected) continue;
    // Gentle floating bob
    ring.mesh.position.y = ring.yPos + Math.sin(t * 1.8 + ring.zPos) * 0.15;
    // Slow Y-axis spin so the ring faces slightly differently over time
    ring.mesh.rotation.y = Math.sin(t * 0.6 + ring.zPos) * 0.35;
    // Animate orbiting particles and center sparkle
    ring.mesh.children.forEach((child: any) => {
      if (child.userData.orbitAngle !== undefined) {
        const a = child.userData.orbitAngle + t * 2.0;
        const r = child.userData.orbitRadius;
        child.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      }
      if (child.userData.isSparkle) {
        child.rotation.y = t * 3;
        child.rotation.x = t * 2;
        const pulse = 0.8 + Math.sin(t * 4) * 0.2;
        child.scale.set(pulse, pulse, pulse);
      }
    });
  }
}

function updateMultiplierDisplay(): void {
  const el = document.getElementById("multiplier-display");
  if (!el) return;
  if (gameState.multiplier > 1) {
    el.textContent = `×${gameState.multiplier}`;
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}

// ============================================================
// THROW FRISBEE
// ============================================================

function throwFrisbee(): void {
  if (gameState.phase !== "aiming") return;

  const config = window.gameConfig;
  const dx = gameState.dragCurrent.x - gameState.dragStart.x;
  const dy = gameState.dragCurrent.y - gameState.dragStart.y;
  const swipeLength = Math.sqrt(dx * dx + dy * dy);

  const start = gameState.throwerPos.clone();
  start.y = 2.0;
  const end = gameState.receiverPos.clone();
  end.y = 2.0;

  const power =
    Math.min(swipeLength / 100, 2) * (config.frisbeeSpeedMultiplier || 1);
  const controlOffsetX = -(dx / swipeLength) * power * 15;
  const verticalPower = Math.abs(dy / swipeLength) * power;
  const controlOffsetZ = verticalPower * 5;

  const midZ = (start.z + end.z) / 2;
  const controlPoint = new THREE.Vector3(
    start.x + controlOffsetX,
    2.0,
    midZ + controlOffsetZ,
  );

  gameState.curvePath = {
    start,
    control: controlPoint,
    end,
    progress: 0,
    duration: 1.0,
  };
  gameState.phase = "flying";
  gameState.frisbeePos.copy(start);
  prevFrisbeePos.copy(start); // Init previous pos at throw start
  gameState.isDragging = false;

  frisbeeMesh.visible = true;
  frisbeeMesh.position.copy(start);
  throwerSprite.visible = false;

  playThrowSfx();

  const tc = document.getElementById("trajectory-canvas") as HTMLCanvasElement;
  const ctx = tc.getContext("2d")!;
  ctx.clearRect(0, 0, tc.width, tc.height);
}

// ============================================================
// UPDATE FRISBEE PHYSICS (Bezier curve)
// ============================================================

// Previous frisbee position for swept collision detection (anti-tunneling)
let prevFrisbeePos = new THREE.Vector3();

function updateFrisbee(deltaTime: number): void {
  if (gameState.phase !== "flying" || !gameState.curvePath) return;

  // Save previous position before updating (for swept ring collision)
  prevFrisbeePos.copy(gameState.frisbeePos);

  gameState.curvePath.progress += deltaTime / gameState.curvePath.duration;
  const t = Math.min(1, Math.max(0, gameState.curvePath.progress));
  const omt = 1 - t;
  const { start, control, end } = gameState.curvePath;

  const newPos = new THREE.Vector3(
    omt * omt * start.x + 2 * omt * t * control.x + t * t * end.x,
    omt * omt * start.y + 2 * omt * t * control.y + t * t * end.y,
    omt * omt * start.z + 2 * omt * t * control.z + t * t * end.z,
  );

  gameState.frisbeePos.copy(newPos);

  const velocity = new THREE.Vector3(
    2 * omt * (control.x - start.x) + 2 * t * (end.x - control.x),
    2 * omt * (control.y - start.y) + 2 * t * (end.y - control.y),
    2 * omt * (control.z - start.z) + 2 * t * (end.z - control.z),
  );

  gameState.frisbeeRotation += deltaTime * 10;
  frisbeeMesh.position.copy(gameState.frisbeePos);
  frisbeeMesh.rotation.y = gameState.frisbeeRotation;
  frisbeeMesh.rotation.z = Math.sin(Math.atan2(velocity.x, velocity.z)) * 0.3;

  updateTrail();

  // Check ring collection
  checkRingCollection();

  const collidedPole = checkCollision();
  if (collidedPole) {
    handleCollision(collidedPole);
    return;
  }
  if (t >= 1) {
    successfulCatch();
    return;
  }
}

// ============================================================
// SUCCESSFUL CATCH
// ============================================================

function successfulCatch(): void {
  gameState.score += gameState.multiplier;

  // SDK: haptic feedback on successful catch
  try {
    window.RemixSDK?.hapticFeedback();
  } catch (_) {
    /* ignore */
  }

  const fireworksPos = gameState.receiverPos.clone();
  fireworksPos.y = 3;
  spawnFireworks(fireworksPos);

  document.getElementById("score-value")!.textContent = String(gameState.score);

  const cd = document.getElementById("combo-display")!;
  const successMessages = [
    "NICE CATCH!",
    "ON FIRE!",
    "BULLSEYE!",
    "SMOOTH!",
    "NAILED IT!",
    "TOO EASY!",
    "UNSTOPPABLE!",
    "WICKED!",
    "EPIC THROW!",
    "STELLAR!",
    "BOOM!",
    "FLAWLESS!",
    "LEGEND!",
    "SAVAGE!",
    "CLUTCH!",
  ];
  const successColors = ["#FFFFFF", "#FFE082", "#B3E5FC"];
  let msg = successMessages[Math.floor(Math.random() * successMessages.length)];
  const clr = successColors[Math.floor(Math.random() * successColors.length)];
  cd.textContent = msg;
  cd.style.color = clr;
  cd.classList.add("visible");
  setTimeout(() => {
    cd.classList.remove("visible");
    cd.style.color = "#FFD54F";
  }, 800);

  clearTrail();
  trailMeshes.forEach((m) => {
    if (m) m.visible = false;
  });

  // Hide both frisbees during transition — throwerSprite will reappear in aiming phase
  frisbeeMesh.visible = false;
  throwerSprite.visible = false;

  gameState.phase = "transitioning";
  gameState.transitionProgress = 0;
}

// ============================================================
// TRANSITION TO NEXT THROW
// ============================================================

function updateTransition(deltaTime: number): void {
  if (gameState.phase !== "transitioning") return;

  gameState.transitionProgress += deltaTime * 2;
  if (gameState.transitionProgress >= 1) {
    const baseDistance = window.gameConfig.baseDistance || 28;
    gameState.throwerPos.copy(gameState.receiverPos);
    gameState.receiverPos.z += baseDistance;

    gameState.frisbeePos.set(
      gameState.throwerPos.x + 0.91,
      2.1,
      gameState.throwerPos.z + 0.28,
    );
    gameState.frisbeeVel.set(0, 0, 0);
    clearTrail();

    throwerSprite.position.copy(gameState.throwerPos);
    receiverSprite.position.copy(gameState.receiverPos);
    frisbeeMesh.position.copy(gameState.frisbeePos);
    frisbeeMesh.rotation.set(0, 0, 0);
    gameState.frisbeeRotation = 0;

    camera.position.set(
      gameState.throwerPos.x,
      16,
      gameState.throwerPos.z - 10,
    );
    camera.lookAt(gameState.throwerPos.x, 0, gameState.throwerPos.z + 10);

    createBaseMarkers();
    generateObstacles();

    const tsz = gameState.throwerPos.z + 10;
    groundMesh.position.z = tsz;
    skyMesh.position.z = gameState.throwerPos.z;
    stadiumElements.forEach((el) => {
      el.position.z =
        el.userData.baseZOffset !== undefined
          ? tsz + el.userData.baseZOffset
          : tsz;
    });

    gameState.phase = "aiming";
  } else {
    const t = gameState.transitionProgress;
    const et = t * t * (3 - 2 * t);
    const startZ = gameState.throwerPos.z - 10;
    const endZ = gameState.receiverPos.z - 10;
    camera.position.y = 16;
    camera.position.z = startZ + (endZ - startZ) * et;
    camera.lookAt(0, 0, camera.position.z + 22);
  }
}

// ============================================================
// COLLISION HANDLING
// ============================================================

function handleCollision(collidedObstacle: PoleData | WallData): void {
  gameState.lives--;
  playCollisionSfx();
  updateLivesDisplay();

  // SDK: haptic feedback on collision
  try {
    window.RemixSDK?.hapticFeedback();
  } catch (_) {
    /* ignore */
  }

  const cd = document.getElementById("combo-display")!;
  const failMsgs = ["FAIL!", "MISS!", "CRASH!", "OOPS!", "WIPEOUT!"];
  cd.textContent = failMsgs[Math.floor(Math.random() * failMsgs.length)];
  cd.style.color = "#ffffff";
  cd.style.textShadow =
    "0 0 10px #ff1493, 0 0 20px #ff1493, 0 2px 0 #222, 0 3px 8px rgba(0,0,0,0.9)";
  cd.classList.add("visible");
  setTimeout(() => {
    cd.classList.remove("visible");
    cd.style.color = "#FFD54F";
    cd.style.textShadow = "";
  }, 1000);

  gameState.phase = "collision";
  gameState.collisionAnimTime = 0;
  gameState.collisionStartPos = gameState.frisbeePos.clone();
  gameState.collisionVelocity = new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    2,
    gameState.frisbeeVel.z * 0.3,
  );
  gameState.collisionRotVel = (Math.random() - 0.5) * 20;
}

function updateLivesDisplay(): void {
  for (let i = 1; i <= 3; i++) {
    const li = document.getElementById(`life-${i}`);
    if (li) {
      if (i > gameState.lives) li.classList.add("lost");
      else li.classList.remove("lost");
    }
  }
}

function updateCollisionAnimation(deltaTime: number): void {
  if (gameState.phase !== "collision") return;

  gameState.collisionAnimTime += deltaTime;

  // Smooth screen shake: decaying sinusoidal oscillation
  const t = gameState.collisionAnimTime;
  const decay = Math.exp(-t * 4.0); // exponential decay
  const intensity = 0.6 * decay;
  const freqX = 25; // horizontal oscillation frequency
  const freqY = 18; // vertical oscillation frequency (different to avoid repetition)
  const sx = Math.sin(t * freqX) * intensity;
  const sy = Math.cos(t * freqY) * intensity * 0.6;
  camera.position.set(
    gameState.throwerPos.x + sx,
    16 + sy,
    gameState.throwerPos.z - 10,
  );
  camera.lookAt(
    gameState.throwerPos.x + sx * 0.3,
    0,
    gameState.throwerPos.z + 10,
  );

  if (gameState.collisionVelocity) {
    gameState.collisionVelocity.y -= 15 * deltaTime;
    gameState.frisbeePos.x += gameState.collisionVelocity.x * deltaTime;
    gameState.frisbeePos.y += gameState.collisionVelocity.y * deltaTime;
    gameState.frisbeePos.z += gameState.collisionVelocity.z * deltaTime;
  }

  gameState.frisbeeRotation += gameState.collisionRotVel * deltaTime;
  frisbeeMesh.rotation.y = gameState.frisbeeRotation;
  frisbeeMesh.rotation.x += deltaTime * 8;
  frisbeeMesh.rotation.z += deltaTime * 6;
  frisbeeMesh.position.copy(gameState.frisbeePos);

  if (gameState.frisbeePos.y < -2 || gameState.collisionAnimTime > 1.5) {
    if (gameState.lives <= 0) {
      gameOver();
    } else {
      gameState.phase = "aiming";
      gameState.frisbeePos.set(
        gameState.throwerPos.x,
        2.0,
        gameState.throwerPos.z,
      );
      frisbeeMesh.position.copy(gameState.frisbeePos);
      frisbeeMesh.rotation.set(0, 0, 0);
      clearTrail();
    }
  }
}

// ============================================================
// LEADERBOARD
// ============================================================

async function submitAndDisplayLeaderboard(score: number): Promise<void> {
  const el = document.getElementById("leaderboard-entries")!;
  el.innerHTML =
    '<div class="leaderboard-loading">Loading leaderboard...</div>';

  try {
    const response = await lib.addPlayerScoreToLeaderboard(score, 10);
    if (response.success && response.entries && response.entries.length > 0) {
      el.innerHTML = "";
      response.entries.forEach((entry: any, index: number) => {
        const div = document.createElement("div");
        div.className = "leaderboard-entry";
        const isCP =
          response.userRank !== null && index + 1 === response.userRank;
        if (isCP) div.classList.add("current-player");

        const rank = index + 1;
        const rankSpan = document.createElement("span");
        rankSpan.className = "leaderboard-rank";
        if (rank <= 3) rankSpan.classList.add("top3", `rank${rank}`);
        rankSpan.textContent = `#${rank}`;
        div.appendChild(rankSpan);

        const img = document.createElement("img");
        img.className = "leaderboard-profile";
        const fallbackSvg =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23888"/><circle cx="50" cy="40" r="20" fill="%23fff"/><circle cx="50" cy="85" r="30" fill="%23fff"/></svg>';
        img.src = entry.profilePicture || fallbackSvg;
        img.alt = entry.username;
        img.onerror = function (this: HTMLImageElement) {
          this.src = fallbackSvg;
        };
        div.appendChild(img);

        const info = document.createElement("div");
        info.className = "leaderboard-info";
        const uname = document.createElement("span");
        uname.className = "leaderboard-username";
        uname.textContent = entry.username || "Anonymous";
        info.appendChild(uname);
        div.appendChild(info);

        const sc = document.createElement("span");
        sc.className = "leaderboard-score";
        sc.textContent = entry.score;
        div.appendChild(sc);

        el.appendChild(div);
      });
    } else {
      el.innerHTML =
        '<div class="leaderboard-loading">Be the first to set a score!</div>';
    }
  } catch (error: any) {
    lib.log(`Failed to load leaderboard: ${error.message}`);
    el.innerHTML =
      '<div class="leaderboard-error">Unable to load leaderboard. Play as a registered user to compete!</div>';
  }
}

// ============================================================
// GAME OVER
// ============================================================

async function gameOver(): Promise<void> {
  gameState.phase = "gameover";
  stopMusic();

  // SDK: report game over with score
  try {
    window.RemixSDK?.singlePlayer.actions.gameOver({ score: gameState.score });
  } catch (e) {
    lib.log("RemixSDK gameOver error: " + e);
  }

  // SDK: haptic feedback on game over
  try {
    window.RemixSDK?.hapticFeedback();
  } catch (_) {
    /* ignore */
  }

  if (gameState.score > gameState.bestScore) {
    gameState.bestScore = gameState.score;
    document.getElementById("best-value")!.textContent = String(
      gameState.bestScore,
    );

    const currentState = await lib.getUserGameState();
    const state: Record<string, unknown> = currentState?.state || {};
    state.bestScore = gameState.bestScore;
    if (selectedFrisbeeId) state.selectedFrisbee = selectedFrisbeeId;
    await lib.saveUserGameState(state);
  }

  // Submit score to leaderboard in background
  submitAndDisplayLeaderboard(gameState.score);

  // Auto-restart after a short pause
  setTimeout(() => {
    restartGame();
  }, 1200);
}

// ============================================================
// RESTART
// ============================================================

function restartGame(): void {
  clearTrail();

  gameState.score = 0;
  gameState.combo = 1;
  gameState.lives = 3;
  gameState.multiplier = 1;
  gameState.phase = "aiming";
  updateLivesDisplay();
  updateMultiplierDisplay();

  gameState.throwerPos.set(0, 0, 0);
  gameState.receiverPos.set(0, 0, window.gameConfig.baseDistance || 28);
  gameState.frisbeePos.set(0, 2.0, 0);
  gameState.frisbeeVel.set(0, 0, 0);
  gameState.frisbeeRotation = 0;

  throwerSprite.position.copy(gameState.throwerPos);
  receiverSprite.position.copy(gameState.receiverPos);
  frisbeeMesh.position.copy(gameState.frisbeePos);
  frisbeeMesh.rotation.set(0, 0, 0);

  camera.position.set(0, 16, -10);
  camera.lookAt(0, 0, 10);
  groundMesh.position.z = 10;

  document.getElementById("score-value")!.textContent = "0";

  const tut = document.getElementById("tutorial-message");
  if (tut) tut.classList.add("visible");

  createBaseMarkers();
  generateObstacles();

  startMusic();
}

// ============================================================
// TRAJECTORY PREVIEW
// ============================================================

function drawTrajectory(): void {
  const canvas = document.getElementById(
    "trajectory-canvas",
  ) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState.phase !== "aiming" || !gameState.isDragging) return;

  const dx = gameState.dragCurrent.x - gameState.dragStart.x;
  const dy = gameState.dragCurrent.y - gameState.dragStart.y;
  const swipeLength = Math.sqrt(dx * dx + dy * dy);
  if (swipeLength < 10) return;

  // Build the same Bézier curve that throwFrisbee would use
  const config = window.gameConfig;
  const start = gameState.throwerPos.clone();
  start.y = 2.0;
  const end = gameState.receiverPos.clone();
  end.y = 2.0;

  const power =
    Math.min(swipeLength / 100, 2) * (config.frisbeeSpeedMultiplier || 1);
  const controlOffsetX = -(dx / swipeLength) * power * 15;
  const verticalPower = Math.abs(dy / swipeLength) * power;
  const controlOffsetZ = verticalPower * 5;

  const midZ = (start.z + end.z) / 2;
  const control = new THREE.Vector3(
    start.x + controlOffsetX,
    2.0,
    midZ + controlOffsetZ,
  );

  // Project 3D points onto 2D screen
  const dpr = renderer.getPixelRatio();
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const _v = new THREE.Vector3();

  function project(p: THREE.Vector3): { x: number; y: number } | null {
    _v.copy(p).project(camera);
    if (_v.z < -1 || _v.z > 1) return null;
    return {
      x: ((_v.x + 1) / 2) * w,
      y: ((-_v.y + 1) / 2) * h,
    };
  }

  // Sample Bézier curve at intervals
  const NUM_DOTS = 18;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= NUM_DOTS; i++) {
    const t = i / NUM_DOTS;
    const omt = 1 - t;
    const bx = omt * omt * start.x + 2 * omt * t * control.x + t * t * end.x;
    const by = omt * omt * start.y + 2 * omt * t * control.y + t * t * end.y;
    const bz = omt * omt * start.z + 2 * omt * t * control.z + t * t * end.z;
    const pt = project(new THREE.Vector3(bx, by, bz));
    if (pt) points.push(pt);
  }

  if (points.length < 2) return;

  // Rainbow colors for the dotted path
  const rainbow = [
    [255, 107, 107], // coral
    [255, 159, 67], // orange
    [255, 217, 61], // yellow
    [0, 229, 160], // green
    [0, 212, 255], // cyan
    [108, 99, 255], // purple
    [255, 107, 255], // pink
  ];

  // Draw rainbow dotted path with glow
  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1);
    const ci = t * (rainbow.length - 1);
    const lo = Math.floor(ci);
    const hi = Math.min(lo + 1, rainbow.length - 1);
    const f = ci - lo;
    const r = Math.round(
      rainbow[lo][0] + (rainbow[hi][0] - rainbow[lo][0]) * f,
    );
    const g = Math.round(
      rainbow[lo][1] + (rainbow[hi][1] - rainbow[lo][1]) * f,
    );
    const b = Math.round(
      rainbow[lo][2] + (rainbow[hi][2] - rainbow[lo][2]) * f,
    );

    const alpha = 0.35 + 0.55 * t;
    const radius = 3.0 + 1.2 * (1 - t);

    // Soft glow
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`;
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fill();
  }
}

// ============================================================
// INPUT HANDLING
// ============================================================

function setupInput(): void {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const tutorialMessage = document.getElementById("tutorial-message");
  const MIN_SWIPE_DISTANCE = 40;

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (gameState.phase === "aiming") {
      const touch = e.touches[0];
      gameState.isDragging = true;
      gameState.dragStart = { x: touch.clientX, y: touch.clientY };
      gameState.dragCurrent = { x: touch.clientX, y: touch.clientY };
      if (tutorialMessage) tutorialMessage.classList.remove("visible");
    }
    if (audioContext && audioContext.state === "suspended")
      audioContext.resume();
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (gameState.isDragging && gameState.phase === "aiming") {
      const touch = e.touches[0];
      gameState.dragCurrent = { x: touch.clientX, y: touch.clientY };
      drawTrajectory();
    }
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (gameState.phase === "aiming" && gameState.isDragging) {
      const dx = gameState.dragCurrent.x - gameState.dragStart.x;
      const dy = gameState.dragCurrent.y - gameState.dragStart.y;
      if (Math.sqrt(dx * dx + dy * dy) >= MIN_SWIPE_DISTANCE) {
        throwFrisbee();
      } else {
        gameState.isDragging = false;
        const tc = document.getElementById(
          "trajectory-canvas",
        ) as HTMLCanvasElement;
        tc.getContext("2d")!.clearRect(0, 0, tc.width, tc.height);
      }
    }
  });

  canvas.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    gameState.isDragging = false;
    const tc = document.getElementById(
      "trajectory-canvas",
    ) as HTMLCanvasElement;
    tc.getContext("2d")!.clearRect(0, 0, tc.width, tc.height);
  });

  // Mouse events
  canvas.addEventListener("mousedown", (e) => {
    if (gameState.phase === "aiming") {
      gameState.isDragging = true;
      gameState.dragStart = { x: e.clientX, y: e.clientY };
      gameState.dragCurrent = { x: e.clientX, y: e.clientY };
      if (tutorialMessage) tutorialMessage.classList.remove("visible");
    }
    if (audioContext && audioContext.state === "suspended")
      audioContext.resume();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (gameState.isDragging && gameState.phase === "aiming") {
      gameState.dragCurrent = { x: e.clientX, y: e.clientY };
      drawTrajectory();
    }
  });

  canvas.addEventListener("mouseup", () => {
    if (gameState.phase === "aiming" && gameState.isDragging) {
      const dx = gameState.dragCurrent.x - gameState.dragStart.x;
      const dy = gameState.dragCurrent.y - gameState.dragStart.y;
      if (Math.sqrt(dx * dx + dy * dy) >= MIN_SWIPE_DISTANCE) {
        throwFrisbee();
      } else {
        gameState.isDragging = false;
        const tc = document.getElementById(
          "trajectory-canvas",
        ) as HTMLCanvasElement;
        tc.getContext("2d")!.clearRect(0, 0, tc.width, tc.height);
      }
    }
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && gameState.phase === "aiming") {
      gameState.dragStart = { x: 360, y: 640 };
      gameState.dragCurrent = { x: 360, y: 540 };
      if (tutorialMessage) tutorialMessage.classList.remove("visible");
      throwFrisbee();
    }
  });

  // Restart button
  document
    .getElementById("restart-btn")!
    .addEventListener("click", restartGame);
  document.getElementById("restart-btn")!.addEventListener("touchend", (e) => {
    e.preventDefault();
    restartGame();
  });

  // Frisbee selector
  document
    .getElementById("frisbee-selector-btn")!
    .addEventListener("click", (e) => {
      e.preventDefault();
      openFrisbeeSelector();
    });
  document
    .getElementById("frisbee-selector-btn")!
    .addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFrisbeeSelector();
    });

  document
    .getElementById("close-frisbee-selector")!
    .addEventListener("click", (e) => {
      e.preventDefault();
      closeFrisbeeSelector();
    });
  document
    .getElementById("close-frisbee-selector")!
    .addEventListener("touchend", (e) => {
      e.preventDefault();
      closeFrisbeeSelector();
    });

  document.getElementById("frisbee-overlay")!.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "frisbee-overlay")
      closeFrisbeeSelector();
  });
}

// ============================================================
// FRISBEE SELECTOR UI
// ============================================================

function applyFrisbeeDesign(
  _frisbeeGroup: THREE.Group,
  _design: FrisbeeDesign,
): void {
  // No-op: always keep the hardcoded purple frisbee with star decal
  return;
}

function openFrisbeeSelector(): void {
  const overlay = document.getElementById("frisbee-overlay")!;
  const container = document.getElementById("frisbee-options")!;
  container.innerHTML = "";

  frisbeeDesigns.forEach((design) => {
    const opt = document.createElement("div");
    opt.className = "frisbee-option";

    const isUnlocked =
      window.gameConfig.devMode || gameState.bestScore >= design.unlockScore;
    const isSelected = selectedFrisbeeId === design.id;
    if (!isUnlocked) opt.classList.add("locked");
    if (isSelected) opt.classList.add("selected");

    const preview = document.createElement("div");
    preview.className = "frisbee-preview";
    preview.style.background = `radial-gradient(circle, #${design.baseColor.toString(16).padStart(6, "0")} 0%, #${design.rimColor.toString(16).padStart(6, "0")} 100%)`;
    preview.style.border = `4px solid #${design.rimColor.toString(16).padStart(6, "0")}`;
    preview.innerHTML = `<span style="font-size: 48px; color: #${design.starColor.toString(16).padStart(6, "0")}; text-shadow: 0 0 8px rgba(255,255,255,0.5);">★</span>`;
    if (!isUnlocked) preview.innerHTML += '<div class="lock-icon">🔒</div>';
    opt.appendChild(preview);

    const nameDiv = document.createElement("div");
    nameDiv.className = "frisbee-name";
    nameDiv.textContent = design.name;
    opt.appendChild(nameDiv);

    const unlockDiv = document.createElement("div");
    unlockDiv.className = "frisbee-unlock";
    unlockDiv.textContent = isUnlocked
      ? isSelected
        ? "✓ Selected"
        : "Unlocked"
      : `Score ${design.unlockScore}+`;
    opt.appendChild(unlockDiv);

    if (isUnlocked) {
      opt.addEventListener("click", () => {
        selectedFrisbeeId = design.id;
        saveSelectedFrisbee(design.id);
        applyFrisbeeDesign(frisbeeMesh, design);
        applyFrisbeeDesign(throwerSprite, design);
        openFrisbeeSelector();
      });
    }

    container.appendChild(opt);
  });

  overlay.classList.add("visible");
}

function closeFrisbeeSelector(): void {
  document.getElementById("frisbee-overlay")!.classList.remove("visible");
}

// ============================================================
// STATE PERSISTENCE
// ============================================================

async function loadSavedState(): Promise<void> {
  try {
    const saved = await lib.getUserGameState();
    if (saved && saved.state) {
      if ((saved.state as any).bestScore) {
        gameState.bestScore = (saved.state as any).bestScore;
        document.getElementById("best-value")!.textContent = String(
          gameState.bestScore,
        );
      }
      // Always use the hardcoded purple frisbee design; ignore saved selection
    }
  } catch {
    lib.log("No saved state found");
  }
}

async function saveSelectedFrisbee(frisbeeId: string): Promise<void> {
  try {
    const currentState = await lib.getUserGameState();
    const state: Record<string, unknown> = currentState?.state || {};
    state.selectedFrisbee = frisbeeId;
    await lib.saveUserGameState(state);
  } catch (e: any) {
    lib.log("Failed to save selected frisbee: " + e.message);
  }
}

// ============================================================
// EDIT / PLAY MODE
// ============================================================

function setupEditMode(): void {
  document.getElementById("edit-indicator")!.classList.add("visible");
  stopMusic();
}

function setupPlayMode(): void {
  document.getElementById("edit-indicator")!.classList.remove("visible");
  startMusic();
}

// ============================================================
// GAME LOOP
// ============================================================

function gameLoop(timestamp: number): void {
  const deltaTime = Math.min(0.11, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (currentMode === "play") {
    const tutorialMessage = document.getElementById("tutorial-message");
    if (tutorialMessage) {
      if (gameState.score === 0 && gameState.phase === "aiming")
        tutorialMessage.classList.add("visible");
      else tutorialMessage.classList.remove("visible");
    }

    // Keep light following the action
    const fx = gameState.frisbeePos.x;
    const fz = gameState.frisbeePos.z;
    dirLight.position.set(fx, 20, fz + 10);

    updatePoles(deltaTime);
    updateWalls();
    updateRings(timestamp);
    updateFrisbee(deltaTime);
    updateTransition(deltaTime);
    updateCollisionAnimation(deltaTime);
    updateFireworks(deltaTime);

    // Aiming phase: floating animation
    if (gameState.phase === "aiming") {
      throwerSprite.visible = true;
      const time = timestamp / 1000;
      const bobH = Math.sin(time * 2) * 0.15;
      const bobR = Math.sin(time * 1.5) * 0.1;

      gameState.frisbeePos.copy(gameState.throwerPos);
      gameState.frisbeePos.y = throwerSprite.userData.baseY + bobH;

      frisbeeMesh.visible = false;

      throwerSprite.position.copy(gameState.throwerPos);
      throwerSprite.position.y = throwerSprite.userData.baseY + bobH;
      throwerSprite.rotation.z = bobR;

      if (throwerSprite.userData.glow) {
        const gs = 1.0 + Math.sin(time * 3) * 0.1;
        throwerSprite.userData.glow.scale.set(gs, gs, gs);
        throwerSprite.userData.glow.material.opacity =
          0.2 + Math.sin(time * 3) * 0.1;
      }
    }

    // Flag waving animation
    if (receiverSprite && receiverSprite.userData.flag) {
      const flagGeo = receiverSprite.userData
        .flagGeometry as THREE.PlaneGeometry;
      const origPos = receiverSprite.userData.flagOriginalPositions as Array<{
        x: number;
        y: number;
        z: number;
      }>;
      const time = timestamp / 1000;
      const positions = flagGeo.attributes.position;

      for (let i = 0; i < positions.count; i++) {
        const ox = origPos[i].x;
        const oy = origPos[i].y;
        const halfW = flagGeo.parameters.width / 2;
        const nx = (ox + halfW) / (halfW * 2);

        const pw = Math.sin(time * 3 + ox * 2.5) * 0.25;
        const sw = Math.sin(time * 5 + ox * 4 + oy) * 0.15;
        const tw = Math.sin(time * 7 + oy * 3) * 0.08;
        const em = Math.pow(nx, 1.8);
        const vw = Math.sin(time * 4 + oy * 2) * 0.1 * em;
        const totalWave = (pw + sw + tw) * em;

        positions.setZ(i, totalWave);
        positions.setX(i, ox + vw * 0.5);
      }
      positions.needsUpdate = true;
    }

    // Stadium elements update (throttled)
    if (timestamp - lastStadiumUpdate > 100) {
      const tsz = gameState.throwerPos.z + 10;
      stadiumElements.forEach((el) => {
        el.position.z =
          el.userData.baseZOffset !== undefined
            ? tsz + el.userData.baseZOffset
            : tsz;
      });
      if (skyMesh) skyMesh.position.z = gameState.throwerPos.z;
      if (groundMesh) groundMesh.position.z = tsz;
      lastStadiumUpdate = timestamp;
    }

    drawTrajectory();
  }

  renderer.render(scene, camera);
  const nextFrame = requestAnimationFrame(gameLoop);
  (window as any).__frisbee_animFrame = nextFrame;
}

// ============================================================
// SHOW GAME PARAMETERS (edit mode)
// ============================================================

function showGameParameters(): void {
  lib.showGameParameters({
    name: "Game Settings",
    params: {
      "Field Color": {
        key: "gameConfig.fieldColor",
        type: "color",
        onChange: (value: string) => {
          window.gameConfig.fieldColor = value;
          if (groundMesh) (groundMesh.material as any).color.set(value);
        },
      },
      "Pole Speed": {
        key: "gameConfig.poleSpeedMultiplier",
        type: "slider",
        min: 0.5,
        max: 2,
        step: 0.1,
        onChange: (value: number) => {
          window.gameConfig.poleSpeedMultiplier = value;
        },
      },
      "Base Distance": {
        key: "gameConfig.baseDistance",
        type: "slider",
        min: 10,
        max: 30,
        step: 2,
        onChange: (value: number) => {
          window.gameConfig.baseDistance = value;
        },
      },
      "Throw Power": {
        key: "gameConfig.frisbeeSpeedMultiplier",
        type: "slider",
        min: 0.7,
        max: 1.5,
        step: 0.1,
        onChange: (value: number) => {
          window.gameConfig.frisbeeSpeedMultiplier = value;
        },
      },
      "Catch Zone": {
        key: "gameConfig.catchZoneSize",
        type: "dropdown",
        options: [
          { label: "Small", value: "small" },
          { label: "Medium", value: "medium" },
          { label: "Large", value: "large" },
        ],
        onChange: (value: string) => {
          window.gameConfig.catchZoneSize = value;
        },
      },
    },
  });
}

// ============================================================
// MAIN RUN FUNCTION (entry point)
// ============================================================

export async function run(mode: string, audio?: PreloadedAudio): Promise<void> {
  lib.log("run() called. Mode: " + mode);
  currentMode = mode;

  // Apply preloaded audio data from PreloadScene
  if (audio) {
    audioContext = audio.context;
    audioBuffers = audio.buffers;
    musicGainNode = audio.gainNode;
  }

  // Load music tracks from URLs
  await loadMusicBuffers();

  // Initialize game state with THREE vectors
  gameState = {
    phase: "aiming",
    score: 0,
    bestScore: 0,
    combo: 1,
    lives: 3,
    throwerPos: new THREE.Vector3(0, 0, 0),
    receiverPos: new THREE.Vector3(0, 0, window.gameConfig.baseDistance || 28),
    frisbeePos: new THREE.Vector3(0, 2.0, 0),
    frisbeeVel: new THREE.Vector3(0, 0, 0),
    frisbeeRotation: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 },
    throwPower: 0,
    throwAngleH: 0,
    throwAngleV: 0,
    currentDifficulty: 1,
    poleCount: 2,
    poleSpeed: 1,
    gapWidth: 3.5,
    transitionProgress: 0,
    cameraTargetPos: new THREE.Vector3(0, 3, -5),
    throwAnimProgress: 0,
    throwAnimDuration: 0.25,
    collisionAnimTime: 0,
    collisionRotVel: 0,
    multiplier: 1,
  };

  showGameParameters();

  await loadSavedState();

  gameState.receiverPos.set(0, 0, window.gameConfig.baseDistance || 28);

  // Cancel any previous animation loop (HMR safety)
  const staleFrame = (window as any).__frisbee_animFrame;
  if (staleFrame) cancelAnimationFrame(staleFrame);

  initScene();
  setupInput();

  // SDK: register onPlayAgain handler
  try {
    window.RemixSDK?.onPlayAgain(() => {
      restartGame();
    });
  } catch (e) {
    lib.log("RemixSDK onPlayAgain error: " + e);
  }

  // SDK: register onToggleMute handler (REQUIRED even if game has no sound)
  try {
    window.RemixSDK?.onToggleMute((data: { isMuted: boolean }) => {
      isMuted = data.isMuted;
      if (musicGainNode) {
        musicGainNode.gain.value = data.isMuted ? 0 : 0.3;
      }
    });
  } catch (e) {
    lib.log("RemixSDK onToggleMute error: " + e);
  }

  if (mode === "edit") setupEditMode();
  else setupPlayMode();

  const frameId = requestAnimationFrame(gameLoop);
  (window as any).__frisbee_animFrame = frameId;
}
