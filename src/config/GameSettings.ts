/**
 * Game Settings for frisbee-loop (Infinity Frisbee)
 * Centralized configuration for all tunable game parameters
 */

export const GameSettings = {
  canvas: {
    width: 720,
    height: 1280,
  },
  defaults: {
    frisbeeColor: "#F44336",
    fieldColor: "#2E9B3E",
    poleColor: "#FFEB3B",
    characterColor: "#2196F3",
    startingDifficulty: 1,
    difficultyRampSpeed: "medium",
    poleSpeedMultiplier: 1.0,
    baseDistance: 28,
    frisbeeSpeedMultiplier: 1.0,
    catchZoneSize: "medium",
    gravityMultiplier: 1.0,
    devMode: true,
  } as GameConfig,
};

export default GameSettings;
