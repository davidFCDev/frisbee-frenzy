/**
 * Remix Game Configuration
 *
 * This file contains your game's configuration for the Remix framework.
 *
 * Getting Started:
 * 1. This gameId is auto-generated for local save states (localStorage)
 * 2. To publish your game to Remix:
 *    - Run: npx create-remix-game link
 *    - This will authenticate and link your game to Remix
 *    - Your gameId will be updated automatically
 *
 * API Key (for publishing):
 * - Set REMIX_API_KEY environment variable in your .env file
 * - Get your API key from: https://remix.gg/dashboard
 * - Example: REMIX_API_KEY=your_api_key_here
 *
 * Publishing your game:
 * - Run: npx remix-dev deploy
 * - This uploads your game to Remix (requires auth via link command)
 */
export default {
  // Unique identifier for your game
  gameId: '11440585-891a-49a7-aa95-f48c66e1d190', // UUID format - auto-generated or linked to Remix

  // Whether this game is linked to Remix (true after running link command)
  isRemixGame: false,

  // Display name for your game
  gameName: 'frisbee-loop',

  // Multiplayer mode (true = multiplayer, false = singleplayer)
  multiplayer: false,
}
