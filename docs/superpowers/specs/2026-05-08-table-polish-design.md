# Table Polish Design

**Date:** 2026-05-08
**Status:** Approved

## Problems

1. **Wall visual misalignment** — Side wall visuals extend 26px below the bottom walls, creating unclean corners. The launch lane bottom stop visual extends 2px beyond the right wall boundary.
2. **Lives display not reset on new game** — After Game Over, restarting the game leaves the lives display at "0" until a life is lost, then it jumps to 2. The HTML HUD is not reset when GameScene's `create()` runs.
3. **Lives labeled as "Hearts"** — Pinball convention uses "balls" for lives, not hearts.

## Design

### 1. Wall alignment ([GameScene.js:87-123](src/scenes/GameScene.js#L87-L123))

Shorten side wall visual heights from 1050 to 1008px so they meet the bottom walls flush at y=1008. Reduce launch lane bottom stop visual width from 52 to 50px so it aligns with the right wall at x=684. Physics bodies are unchanged — they already align correctly.

- Left side wall visual: `strokeRect(0, 0, 16, 1050)` -> `strokeRect(0, 0, 16, 1008)`
- Right side wall visual: `strokeRect(684, 0, 16, 1050)` -> `strokeRect(684, 0, 16, 1008)`
- Launch lane bottom stop visual: `strokeRect(634, 1012, 52, 16)` -> `strokeRect(634, 1012, 50, 16)`

### 2. Lives reset on game start ([GameScene.js:46](src/scenes/GameScene.js#L46))

Add `this.updateLivesDisplay()` call at the end of `create()`, after `spawnBall()`. This ensures the HTML HUD reflects the correct lives count (3) immediately when the scene starts.

### 3. Hearts to ball icons ([GameScene.js:520](src/scenes/GameScene.js#L520), [index.html:61](index.html#L61))

Change the lives display from "Hearts: N" text to ball icons using `'⚪'.repeat(this.lives)`. Update the initial HTML placeholder to match.

## Files Changed

- `src/scenes/GameScene.js` — wall visuals, lives reset, display format
- `index.html` — initial lives display text
