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

**Three Phaser scenes:**
- **BootScene** — Loads audio SFX, then procedurally generates all visual assets (ball, bumpers, walls, flippers, UI buttons) via Phaser Graphics + `generateTexture()`. Transitions to GameScene.
- **GameScene** — Main gameplay: table layout, bumpers, flippers, ball physics, scoring, lives, input handling, launch power bar.
- **GameOverScene** — Final score, high score (from localStorage), "NEW HIGH SCORE!" animation, restart button.

**Game config** ([src/main.js](src/main.js)): Resolution 700×1050 (portrait), `Phaser.Scale.FIT` with `CENTER_BOTH`, Arcade physics (gravity y=600), 3 active pointers for multi-touch, `disableContextMenu: true` for mobile.

**Entry point:** `index.html` mounts Phaser into `#game-container`, imports `src/main.js` as module. CSS prevents scroll/zoom on mobile.

**Physics:** Arcade physics for ball and walls via static groups. Flippers use tween-based rotation with manual distance-based collision in `update()` — not physics bodies. Ball uses a persistent `ballGroup` so colliders are set once and always reference the current ball.

**Game state:** Score, lives (3), launch state managed on GameScene instance. `isLosingLife` guard prevents double-drain. High score persisted in localStorage under `earkandi_highscore`.

**Scoring:** Star=100, Heart=150, Moon=200, Flower=250. Score popups animate upward and fade on bumper hit.

**Asset pipeline:** All visuals generated procedurally in BootScene — no external image files. Audio generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`): `bumper-hit.wav`, `ball-drain.wav`, `flipper-activate.wav`.

**Controls:**
- Desktop: A/Left = left flipper, D/Right = right flipper, Space = hold-to-charge launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

**Visual features:** Gradient background with scattered rotating decorative shapes, pulsing glow on bumpers, launch power bar (green→red gradient), score popups on bumper hit.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
