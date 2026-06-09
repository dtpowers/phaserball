# Launch Lane Visual Separation — Design Spec

**Date:** 2026-06-09
**Goal:** Aesthetic polish — make the launch lane (x=612–700) feel like a distinct, arcade-flavored zone rather than just a region separated by a thin physics wall.

---

## Problem

The launch lane and play area share the same dark blue gradient background (`0x1a1a2e` → `0x16213e`). Only the 8px divider wall at x=612 separates them visually. This reads as a wall, not as a distinct zone — the lane lacks arcade character.

## Solution

Two layered Graphics elements added to `addBackground()`:

### 1. Lane fill tint

- **What:** A `Graphics.fillRect` covering x=612, y=0, w=88, h=1050 (full lane area)
- **Color:** Amber/gold `0xf5a623` — warm contrast against the cool dark blue field
- **Base alpha:** 0.10 (always-on tint, establishes the zone clearly)
- **Animation:** Phaser tween, alpha breathes between 0.08 and 0.25, 1800ms, `Sine.easeInOut`, `yoyo: true, repeat: -1`

### 2. Divider glow stroke

- **What:** A bright amber stroke (`0xffcf6b`, lineStyle 3px) drawn as a vertical line at x=620 (center of the 16px divider wall), y=0–1050
- **Base alpha:** 0.60
- **Animation:** Same tween target (or separate), alpha breathes between 0.40 and 0.80, same duration/ease for a synchronized pulse

## Implementation location

Both Graphics objects are created inside `addBackground()` in [GameScene.js](src/scenes/GameScene.js), after the base gradient fill and before any other objects — ensuring they sit above the background but below walls and game objects at the default Phaser depth ordering.

## What is NOT changing

- Physics: no changes to the Planck world, divider wall body, or LANE constants
- HUD, walls, bumpers, flippers, ball, input — untouched
- Shutdown behavior: both tweens are Phaser-managed and cleaned up automatically on scene shutdown

## Success criteria

- The lane is visually distinct from the play field at a glance
- The amber pulse is visible but not distracting during gameplay
- No regressions to existing visual features (background shapes, bumper glows, power bar)
- No new teardown code required
