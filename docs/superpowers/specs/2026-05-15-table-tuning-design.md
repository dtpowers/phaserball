# Table Tuning — Launch Power, Corner Deflector, Drain Cleanup

**Date:** 2026-05-15
**Status:** Approved

## Overview

Three independent, low-scope changes to the GameScene table layout and launch mechanics to improve ball launch reliability and simplify the drain area.

## Changes

### 1. Increase launch power — 50% boost

**Problem:** The ball does not reliably clear the launch lane at full charge.

**Solution:** Increase `LAUNCH.velScale` by 1.5×.

| Constant | Before | After |
|---|---|---|
| `velScale` | `0.013125` | `0.0196875` |

Max launch y-velocity increases from ~39 to ~59 px/s. The power bar visual is unchanged — it still fills to `maxPower` (2600) and scales identically. Partial charges receive a proportional boost.

**Why this approach:** Increasing `velScale` rather than `maxPower` keeps the charge time the same and avoids changing the bar-fill-to-max timing. The mapping from bar height to velocity is what changes.

### 2. Top-right corner deflector wall

**Problem:** At full launch power, the ball can travel straight up the launch lane without being deflected into the main play area.

**Solution:** Add a 45° diagonal static wall in the top-right corner.

- **Endpoints:** (620, 80) → (700, 160)
- **Midpoint (physics body center):** (660, 120)
- **Length:** ~113px
- **Thickness:** 16px (matches other wall bodies)
- **Angle:** 45° (`Math.PI / 4` radians)
- **Properties:** `isStatic: true, restitution: 0.3` (matches existing walls)
- **Visual:** 4px line matching other wall graphics, color `0x5a5a8a`

The wall starts at x=620, aligned with the launch lane divider, and angles down-right to meet the right wall area. A full-power launch will strike this diagonal and bounce left into the play field.

### 3. Remove drain throat walls

**Problem:** Two vertical walls below the drain gap (added in a prior change) are no longer needed and should be removed.

**Solution:** Remove both the physics bodies and visual lines for the two throat walls.

- **Remove physics bodies:**
  - `this.matter.add.rectangle(290, 1032, 8, 32, wallOpts)` — left throat
  - `this.matter.add.rectangle(346, 1032, 8, 32, wallOpts)` — right throat
- **Remove visual lines:**
  - `funnelGfx.lineBetween(290, 1016, 290, 1048)`
  - `funnelGfx.lineBetween(346, 1016, 346, 1048)`

The drain gap between the bottom plates remains unchanged (~48px between x=294 and x=342). The ball falls through naturally under gravity.

## Scope

All changes are confined to `src/scenes/GameScene.js`:
- Change 1: `LAUNCH` constant (1 line)
- Change 2: `buildTable()` — add 1 physics body + 1 visual line
- Change 3: `buildTable()` — remove 2 physics bodies + 2 visual lines

No changes to `update()`, input handling, collision detection, scene lifecycle, or other files.

## Risk

Low. Each change is independently reversible:
- If the ball still doesn't clear the launch lane, `velScale` can be tuned further.
- If the corner wall creates unwanted bounce patterns, its angle or position can be adjusted.
- If removing throat walls causes unexpected drain behavior, they can be restored.
