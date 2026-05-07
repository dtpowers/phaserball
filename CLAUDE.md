# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Earkandi Pinball — a statically-hostable 2D pinball game themed around the [earkandi](https://earkandi.net/) brand, built with Phaser 3 and Vite. Fully implemented and playable.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run gen-sfx   # Generate audio SFX files (scripts/gen-sfx.js)
```

## Architecture

**Vite config** ([vite.config.js](vite.config.js)): `root: '.'`, `publicDir: 'public'`, build outputs to `dist/assets`. ES module project (`"type": "module"` in package.json). Single dependency: `phaser@^3.80.1`.

**Three Phaser scenes:**
- **BootScene** — Loads 3 audio SFX, then procedurally generates all visual assets (ball, 4 bumper types, flipper, 3 UI buttons) via Phaser Graphics + `generateTexture()`. Starts GameScene.
- **GameScene** — Main gameplay: table walls, bumpers, flippers, ball physics, scoring, lives, input, launch power bar.
- **GameOverScene** — Overlay (launched via `scene.launch()`, then GameScene is stopped). Shows final score, high score, "NEW HIGH SCORE!" pulse animation, restart button that calls `scene.start('GameScene')`.

**Game config** ([src/main.js](src/main.js)): Resolution 700×1050 (portrait), `Phaser.Scale.FIT` with `CENTER_BOTH`, **Matter physics** (gravity y=1, `enableSleeping: false`, `setBounds: false`), 3 active pointers for multi-touch, `disableContextMenu: true` for mobile.

**Entry point:** `index.html` mounts Phaser into `#game-container`, imports `src/main.js` as module. CSS prevents scroll/zoom on mobile.

**HTML overlay for HUD:** Score, lives, and high score are rendered as HTML elements (`#score-display`, `#lives-display`, `#high-score`) in `index.html`, updated via `document.getElementById()` from scenes — NOT drawn in Phaser.

### Physics (Matter.js)

All physics uses Matter through Phaser's `this.matter` API. Import: `const Matter = Phaser.Physics.Matter.Matter;` (see [GameScene.js:3](src/scenes/GameScene.js#L3)).

- **Walls** — Static rectangles via `this.matter.add.rectangle()` with `isStatic: true, restitution: 0.3` (slight bounce). Includes left/right/top borders, bottom left/right plates (gap in center for drain), launch lane divider, and two funnel guides.
- **Bumpers** — Static circles (`isStatic: true`, `restitution: 1.2`) with `bumperData` attached for collision callback lookup. Collision detected via `matter.world.on('collisionstart')`.
- **Flippers** — Tween-based sprite rotation (60ms active, 120ms rest) with **Matter physics bodies synced each frame**. `leftFlipperBody`/`rightFlipperBody` are dynamic rectangles (`restitution: 0.2`, `friction: 0.4`) pinned by `worldConstraint` at their pivot points. Velocity zeroed before `Matter.Body.setPosition()`/`Matter.Body.setAngle()` in `update()` to prevent explosive ball reactions.
- **Ball** — Created directly via `this.matter.add.image()` in `spawnBall()`. No group pattern. Restitution 0.8, zero friction, circle shape radius 16.

### Game mechanics

- **Launch:** Hold Space (or touch launch button) to charge — gravity is disabled (`setGravity(0, 0)`), power accumulates, ball velocity zeroed. Release fires ball with `xVel: -10` and scaled y velocity. Gravity restored to `(0, 1)`.
- **Relaunch:** If ball falls back into launch lane (`x > 620 && y > 520 && vy > 0`), `ballLaunched` resets to false, allowing another charge-and-launch.
- **Velocity clamp:** Ball speed capped at 300 px/s in `update()` to prevent tunneling.
- **Lives:** 3 lives, `isLosingLife` guard prevents double-drain. Ball drain detected when `y > 1050`. On life lost, ball destroyed and respawned after 1s delay.
- **Game over:** When lives reach 0, high score saved to localStorage (`earkandi_highscore`), GameOverScene launched as overlay, GameScene stopped.
- **Scoring:** Star=100, Heart=150, Moon=200, Flower=250. Score popups animate upward and fade on bumper hit.

### Asset pipeline

All visuals generated procedurally in BootScene — no external image files. Audio generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`): `bumper-hit.wav`, `ball-drain.wav`, `flipper-activate.wav`.

### Controls

- Desktop: A/Left = left flipper, D/Right = right flipper, Space = hold-to-charge launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

### Visual features

Gradient background with scattered rotating decorative shapes, pulsing glow on bumpers, launch power bar (green→red gradient), score popups on bumper hit.

### Pending Work

**Flipper physics overhaul** completed 2026-05-07 (commit `8fb0f57`). Fixed by:
1. Adding `restitution: 0.3` to all table walls for natural ball deflection
2. Changing flipper restitution from `1.0` to `0.2` and friction from `0.05` to `0.4`
3. Zeroing velocity before `setPosition`/`setAngle` in `update()` to prevent explosive ball reactions
Piston constraint approach was tested but unstable; reverted to tween+sync with velocity clearing.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
