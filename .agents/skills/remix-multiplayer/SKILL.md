---
name: remix-multiplayer
description: Enable multiplayer support for a Remix game
---

# Implement Multiplayer Workflow

## Overview

This skill guides you through enabling and integrating multiplayer functionality
for games on the Remix platform. Current platform support is two-player,
turn-based multiplayer using the SDK `multiplayer` namespace.

## Prerequisites

- A game must be created on the Remix platform (you need a game ID).
- The `REMIX_API_KEY` environment variable must be set.
- The game must include the RemixSDK script tag:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@remix-gg/sdk@latest/dist/index.min.js"></script>
  ```

## Steps

### 1. Check for Existing Game ID

Use `gameId` from task context or prior tool results when available.

Otherwise, read the nearest `.remix-cli.json`. Older projects may still use
`.remix-mcp.json`. If either contains a `gameId`, reuse it.

Only if none of those sources contain a `gameId` should you follow the
**upload-game** workflow to create one.

### 2. Enable Multiplayer

Do not rely on `updateGame` or a direct REST `isMultiplayer` toggle. Upstream
workflow docs currently treat multiplayer platform enablement as a Remix-side
flag, not a public agent mutation.

### 3. Integrate Multiplayer in Game Code

```js
const sdk = window.RemixSDK
await sdk.ready()

// Access all players in the session
const players = sdk.players // Array of player objects

// Listen for game state updates from other players
sdk.onGameStateUpdated((state) => {
  // Sync game state from other players
})

// Send game state to the other player when a turn ends
sdk.multiplayer.actions.saveGameState({
  gameState: currentState,
  alertUserIds: [opponent.id],
})
```

### Important: Use Multiplayer gameOver

For multiplayer games, use `multiplayer.actions.gameOver` -- NOT
`singlePlayer.actions.gameOver`. Pass a score array with player IDs:

```js
sdk.multiplayer.actions.gameOver({
  scores: [
    { playerId: player.id, score: playerScore },
    { playerId: opponent.id, score: opponentScore },
  ]
})
```

### Keep Standard Hooks

Multiplayer games still need these callbacks:

```js
sdk.onPlayAgain(() => {
  // Reset game state and restart
})

sdk.onToggleMute(({ isMuted }) => {
  // Mute or unmute all audio
})
```

## Tips

- Use `sdk.players` to get the two players and their IDs; multiplayer is
  currently two-player only.
- `onGameStateUpdated` fires whenever another player sends state -- validate it
  before applying it, and use `sdk.multiplayer.actions.refuteGameState(...)`
  when an incoming update is invalid.
- Use `alertUserIds` when saving multiplayer state so the next player is
  notified that it is their turn.
- Do NOT mix `singlePlayer.actions.gameOver` and `multiplayer.actions.gameOver`
  in the same game. Use one or the other.
