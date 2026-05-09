# Bug Fixes: Flipper Velocity, Bumper Animation, Flipper Visuals, Collision

**Date:** 2026-05-08
**Status:** Approved

## Overview

Four targeted bug fixes across `GameScene.js` and `BootScene.js`. No architectural changes, no new dependencies.

## Bug #1: Flipper velocity too low (30% increase)

### Problem
Flippers don't launch the ball hard enough — both visually slow and physically weak.

### Changes
- **GameScene.js** — `flipLeft()` / `flipRight()`: Reduce active tween duration 60ms → 42ms.
- **GameScene.js** — `releaseLeft()` / `releaseRight()`: Reduce rest tween duration 120ms → 84ms.
- **GameScene.js** — `update()`: Replace `setAngularVelocity(body, 0)` with `setAngularVelocity(body, body.angularVelocity * 1.4)` for both flippers. This preserves rotational direction while amplifying it 30%.

## Bug #2: Bumper animation stuck at enlarged size

### Problem
Rapid successive hits queue conflicting tweens, causing scale values to compound and never return to baseline.

### Changes
- **GameScene.js** — `setupCollisions()`: Add `from: { scaleX: 0.288, scaleY: 0.288 }` to the hit tween, with target scales of `0.331` (0.288 × 1.15). This forces each tween to start from the known baseline size, preventing compounding.

## Bug #3: Right flipper doesn't mirror left flipper

### Problem
The arc direction in the right flipper's tip drawing (`true` = clockwise) produces a subtly different curve than the left flipper's tip (`false` = counter-clockwise).

### Changes
- **BootScene.js** — `generateAssets()`: Change the right flipper's arc call from `arc(0, 14, 4, -Math.PI*0.5, Math.PI*0.5, true)` to `arc(0, 14, 4, Math.PI*0.5, -Math.PI*0.5, false)`. This makes both tips use counter-clockwise arcs, producing symmetric rounded tips.

## Bug #4: Flipper bottom clips through ball

### Problem
The physics body tip is only 8px wide (±4 half-width), narrow enough for the ball to tunnel through at high speeds. Additionally, zeroing angular velocity each frame removes proper rotational collision state.

### Changes
- **GameScene.js** — `buildFlippers()`: Widen flipper body tip half-width from ±4 to ±6 on both left and right flipper vertices. This better matches the visual 8px tip and reduces tunneling.
- **GameScene.js** — `update()`: Preserving angular velocity (from Bug #1 fix) maintains proper rotational collision detection state.

## Files affected

- `src/scenes/GameScene.js` — bugs 1, 2, 4
- `src/scenes/BootScene.js` — bug 3
