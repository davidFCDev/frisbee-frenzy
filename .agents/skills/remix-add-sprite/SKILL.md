---
name: remix-add-sprite
description: Generate and add sprites to a Remix game
---

# Add Sprite to Game Workflow

## Overview

This skill guides you through generating sprite sheets for canvas-based games
on the Remix platform.

## Prerequisites

- The game HTML file must already exist (follow the **game-creation** workflow
  first if starting from scratch).
- A game must be created on the Remix platform (you need a game ID).
- The `REMIX_API_KEY` environment variable must be set.

## Steps

### 1. Check for Existing Game ID

Use `gameId` from task context or prior tool results when available.

Otherwise, read the nearest `.remix-cli.json`. Older projects may still use
`.remix-mcp.json`. If either contains a `gameId`, reuse it.

Only if none of those sources contain a `gameId` should you follow the
**upload-game** workflow to create one.

### 2. Generate the Sprite Sheet

Prefer MCP `generateSpriteSheet`:

```js
generateSpriteSheet({
  gameId: "<your-game-id>",
  prompt: "a pixel-art knight walking, side view, 2D game character",
  gridSize: 4
})
```

The response includes hosted `spriteUrl`, `transparentSpriteUrl`, grid metadata,
and any warnings. If you need to write REST calls instead, confirm the exact
schema from the OpenAPI spec first.

### 3. Integrate the Sprite Sheet into the Game

Use the returned URL with canvas `drawImage` to render individual frames:

```js
const sprite = new Image();
sprite.src = "https://returned-sprite-url.png";

const frameWidth = 64;  // width of a single frame
const frameHeight = 64; // height of a single frame
const totalFrames = 4;
let currentFrame = 0;

sprite.onload = () => {
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the current frame from the sprite sheet
    ctx.drawImage(
      sprite,
      currentFrame * frameWidth, 0,  // source x, y in the sprite sheet
      frameWidth, frameHeight,        // source width, height
      player.x, player.y,            // destination x, y on canvas
      frameWidth, frameHeight         // destination width, height
    );

    currentFrame = (currentFrame + 1) % totalFrames;
    requestAnimationFrame(animate);
  }
  animate();
};
```

Use `transparentSpriteUrl` when you need the sprite rendered over other
game elements without a background.

## Tips

- **Be specific about frame count and action.** "4-frame walk cycle" is better
  than "walking character".
- **Specify art style.** Include "pixel-art", "hand-drawn", "flat vector", etc.
  in your prompt.
- **Frame layout follows the returned grid metadata.** Do not assume a single
  horizontal strip; compute frame width and height from the generated sheet and
  requested `gridSize`.
- **Use `transparentSpriteUrl` for in-game sprites** that need to overlay
  backgrounds or other elements.
- **Preload before gameplay.** Wait for `onload` before starting the game loop.
