---
name: Table Improvements
---

# Table Improvements Design

Three targeted fixes to the pinball table geometry and UI in `src/scenes/GameScene.js`.

## 1. Ceiling — Horizontal Wall

**Problem:** The top wall is built with a for-loop placing wall tiles 32px apart, leaving visible gaps.

**Change:** Replace the loop at line 69 with `this.buildHorizontalWall(walls, 16, 684, 16)` — the same tightly-packed helper used for the bottom walls.

## 2. Power Meter — Only Show When Charging

**Problem:** The power bar is always visible, even when the ball is launched and the bar shows no meaningful info.

**Change:** Call `setVisible(true)` on both `powerBarBg` and `powerBarFill` at the start of the charging branch in `update()`, and `setVisible(false)` on both in the `else` branch. The bar appears only while the player is charging the launch.

## 3. Funnel — Invert Direction, Use Diagonal Helper

**Problem:** The funnel diagonals slope upward toward center, pushing the ball away from the drain. The drain endpoints (250/450) don't match the actual drain gap edges (275/425).

**Change:** Swap endpoints so the diagonals slope down toward the drain:
- Left: `(16, 700) → (275, 1016)` — slopes down-right to drain corner
- Right: `(684, 700) → (425, 1016)` — slopes down-left to drain corner

## Scope

Single file: `src/scenes/GameScene.js`. No new helpers, dependencies, or tests required. Each change is a 1-2 line edit.

