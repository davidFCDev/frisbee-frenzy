/**
 * Global type declarations for externally loaded libraries.
 * This is an AMBIENT file (no top-level imports) so all declarations are global.
 * Uses inline import() syntax for type references.
 */

// ============================================================
// THREE.js namespace — provides types for annotations like THREE.Scene, THREE.Vector3
// ============================================================
declare namespace THREE {
  // Core
  export type Scene = import("three").Scene;
  export type PerspectiveCamera = import("three").PerspectiveCamera;
  export type WebGLRenderer = import("three").WebGLRenderer;
  export type Object3D = import("three").Object3D;

  // Objects
  export type Mesh = import("three").Mesh;
  export type Group = import("three").Group;

  // Geometries
  export type PlaneGeometry = import("three").PlaneGeometry;
  export type BoxGeometry = import("three").BoxGeometry;
  export type SphereGeometry = import("three").SphereGeometry;
  export type CylinderGeometry = import("three").CylinderGeometry;
  export type ConeGeometry = import("three").ConeGeometry;
  export type CircleGeometry = import("three").CircleGeometry;
  export type TorusGeometry = import("three").TorusGeometry;
  export type RingGeometry = import("three").RingGeometry;
  export type BufferGeometry = import("three").BufferGeometry;

  // Materials
  export type Material = import("three").Material;
  export type MeshBasicMaterial = import("three").MeshBasicMaterial;
  export type MeshLambertMaterial = import("three").MeshLambertMaterial;
  export type MeshStandardMaterial = import("three").MeshStandardMaterial;
  export type ShaderMaterial = import("three").ShaderMaterial;

  // Math
  export type Vector3 = import("three").Vector3;
  export type Color = import("three").Color;

  // Textures
  export type CanvasTexture = import("three").CanvasTexture;
  export type Texture = import("three").Texture;

  // Lights
  export type AmbientLight = import("three").AmbientLight;
  export type DirectionalLight = import("three").DirectionalLight;

  // Other
  export type Fog = import("three").Fog;
}

// ============================================================
// THREE.js value — runtime access: new THREE.Scene(), THREE.BackSide, etc.
// Loaded via CDN in index.html
// ============================================================
declare const THREE: typeof import("three");

// ============================================================
// Game lib interface (provided by Remix platform in production)
// ============================================================
interface GameLib {
  log: (msg: string) => void;
  getAsset: (id: string) => { url: string } | null;
  addPlayerScoreToLeaderboard: (
    score: number,
    limit: number,
  ) => Promise<{
    success: boolean;
    entries: Array<{
      username: string;
      score: number;
      profilePicture?: string;
    }>;
    userRank: number | null;
  }>;
  getUserGameState: () => Promise<{ state: Record<string, unknown> } | null>;
  saveUserGameState: (state: Record<string, unknown>) => Promise<void>;
  showGameParameters: (config: unknown) => void;
}

// ============================================================
// Game configuration interface
// ============================================================
interface GameConfig {
  frisbeeColor: string;
  fieldColor: string;
  poleColor: string;
  characterColor: string;
  startingDifficulty: number;
  difficultyRampSpeed: string;
  poleSpeedMultiplier: number;
  baseDistance: number;
  frisbeeSpeedMultiplier: number;
  catchZoneSize: string;
  gravityMultiplier: number;
  devMode?: boolean;
}

// ============================================================
// Global variables
// ============================================================
declare const lib: GameLib;
declare const FarcadeSDK: import("@farcade/game-sdk").FarcadeSDK;

// ============================================================
// Window extensions
// ============================================================
interface Window {
  FarcadeSDK?: import("@farcade/game-sdk").FarcadeSDK;
  RemixSDK?: {
    singlePlayer: {
      actions: {
        ready: () => Promise<unknown>;
        gameOver: (data: { score: number }) => void;
        saveGameState: (data: { gameState: unknown }) => void;
      };
    };
    hapticFeedback: () => void;
    onPlayAgain: (cb: () => void) => void;
    onToggleMute: (cb: (data: { isMuted: boolean }) => void) => void;
  };
  gameConfig: GameConfig;
  lib: GameLib;
  game?: unknown;
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}
