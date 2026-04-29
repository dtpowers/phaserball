# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Earkandi Pinball — a statically-hostable 2D pinball game themed around the [earkandi](https://earkandi.net/) brand, built with Phaser 3 and Vite.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run gen-sfx   # Generate audio SFX files (scripts/gen-sfx.js)
```

## Architecture

**Three Phaser scenes:**
- **BootScene** — Procedurally generates all visual assets (shapes, ball, flipper, UI buttons) via Phaser Graphics + `generateTexture()`. Loads audio SFX. Transitions to GameScene.
- **GameScene** — Main gameplay: table layout, bumpers, flippers, ball physics, scoring, lives, input handling.
- **GameOverScene** — Final score, high score (from localStorage), restart button.

**Target resolution:** 1024×768 (iPad portrait) with `Phaser.Scale.FIT` for responsive scaling.

**Physics:** Arcade physics for ball and walls. Flippers use tween-based animation with manual collision detection (not physics bodies).

**Game state:** Score, lives, launch state managed on GameScene instance. High score persisted in localStorage.

**Asset pipeline:** All visuals generated procedurally in BootScene — no external image files. Audio generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`).

**Controls:**
- Desktop: A/Left = left flipper, D/Right = right flipper, Space = launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

## Plan

Implementation plan at `docs/superpowers/plans/2026-04-29-earkandi-pinball.md` — 11 tasks, executed via subagent-driven development.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
