# Flipper Physics Overhaul — Piston Constraint System

## Summary

Replace the tween-plus-manual-sync flipper approach with a piston constraint system. Each flipper becomes a dynamic Matter.js body driven by physics constraints, with the sprite automatically synced via `matter.add.sprite()`. Adds slight bounce to flipper and wall surfaces.

## Problem Statement

### Issue 1: Flipper hitbox does not match visual

The flipper physics body (156x28 rectangle centered at x=199.8/436.2) and the visual sprite (anchored at pivot edges x=121.6/514.4 with origin 0/1) are misaligned. The physics body extends beyond the visible sprite, causing collisions from invisible zones.

### Issue 2: Ball rockets away on flipper contact

`setPosition`/`setAngle` are called on the flipper bodies every frame in `update()`. Matter.js interprets the body's frame-to-frame teleport as enormous velocity. When the ball collides, it receives explosive delta-velocity regardless of whether the flipper is visually moving.

### Issue 3: Stationary flipper too bouncy

Flipper restitution is 1.0, making even a resting flipper act like a bumper. Table walls have no restitution, making ball deflections feel dead.

## Solution: Piston Constraint System

Pattern from Amanda Fager's Phaser pinball reference repo (https://github.com/amandafager/pinball). The core insight: drive flipper motion through physics constraints instead of manual position overrides. The physics engine computes the flipper's true velocity, so ball collisions respond naturally.

### Per-flipper Architecture (5 bodies, 2 constraints)

1. **Pivot body** — Static, invisible 10x10 rectangle (scaled to 0.02) at the pivot point. Serves as the hinge anchor.
2. **Flipper body + sprite** — Dynamic 156x28 rectangle, created via `this.matter.add.sprite()` which binds the sprite to the physics body. Phaser automatically syncs sprite position and angle to the body every frame. No manual sync needed.
3. **Block body** — Static, invisible 10x10 rectangle (scaled to 0.02) positioned above the pivot. Serves as the piston target anchor.
4. **Pin constraint** — Between pivot body and flipper body. `length: 0`, `stiffness: 0.9`. Attaches at `pointB: (-78, 0)` (left) or `(78, 0)` (right), creating a hinge at the flipper's pivot end.
5. **Piston constraint** — Between block body and flipper body. Attaches at `pointB: (-25, -47)` (left) or `(25, -47)` (right). Tweening this constraint's `length` property pushes/pulls the flipper through the physics solver.

### Geometry

**Left flipper:**

| Component | Position | Size | Notes |
|-----------|----------|------|-------|
| Pivot body | (121.6, 820) | 10x10 (scale 0.02) | Static, invisible |
| Flipper body/sprite | (199.8, 820) | 156x28 | Dynamic, initial angle 20 deg |
| Block body | (121.6, 740) | 10x10 (scale 0.02) | Static, invisible, 80px above pivot |
| Pin constraint | pivot <-> flipper | - | pointB: (-78, 0), length: 0, stiffness: 0.9 |
| Piston constraint | block <-> flipper | - | pointB: (-25, -47), rest: 75.7, active: 61.3 |

**Right flipper:**

| Component | Position | Size | Notes |
|-----------|----------|------|-------|
| Pivot body | (514.4, 820) | 10x10 (scale 0.02) | Static, invisible |
| Flipper body/sprite | (436.2, 820) | 156x28 | Dynamic, initial angle -20 deg |
| Block body | (514.4, 740) | 10x10 (scale 0.02) | Static, invisible, 80px above pivot |
| Pin constraint | pivot <-> flipper | - | pointB: (78, 0), length: 0, stiffness: 0.9 |
| Piston constraint | block <-> flipper | - | pointB: (25, -47), rest: 75.7, active: 61.3 |

### Material Properties

- **Flipper body:** Restitution `0.2` (slight bounce), friction `0.4` (ball slides along surface), `isSleepingAllowed: false`.
- **Table walls:** Restitution `0.3` (slight bounce on all walls/borders).
- **Pivot/Block bodies:** Static, scaled to 0.02 (effectively invisible, negligible collision).

### Motion Drive

Tween the piston constraint `length` property:

- **Active (flip):** Tween from `75.7` to `61.3` over 60ms, ease `Sine.easeOut`. Pulls the flipper upward.
- **Rest (release):** Tween from `61.3` to `75.7` over 120ms, ease `Sine.easeOut`. Lets gravity and the pin constraint return the flipper to rest.

### Sprite Alignment

The flipper texture is 156x28 pixels. Created via `this.matter.add.sprite(bodyX, bodyY, 'flipper')` with `setOrigin(0.5, 0.5)`. The sprite center aligns with the body center, so the visual and collision hitbox are identical at all angles. Phaser's Matter sprite coupling updates the sprite's position and angle automatically each frame.

## Changes

### 1. Replace `buildFlippers()` with piston constraint system

**File:** `src/scenes/GameScene.js` — `buildFlippers()` method

Complete replacement. Creates pivot bodies, flipper sprites (via `matter.add.sprite`), block bodies, pin constraints, and piston constraints for both flippers. Stores `pistonRestLength` (75.7) and `pistonActiveLength` (61.3) as instance properties.

### 2. Add flipper actuation methods

**File:** `src/scenes/GameScene.js` — New methods after `buildFlippers()`

Add `flipLeft()`, `releaseLeft()`, `flipRight()`, `releaseRight()`. Each tweens the corresponding piston constraint's `length` property. `flipLeft()` and `flipRight()` also play the flipper-activate sound.

### 3. Update `setupInput()` to use new methods

**File:** `src/scenes/GameScene.js` — `setupInput()` method

Replace all inline tween-based flipper handlers with calls to `flipLeft()`, `releaseLeft()`, `flipRight()`, `releaseRight()`. Keyboard and touch handlers both use the same methods.

### 4. Add slight bounce to table walls

**File:** `src/scenes/GameScene.js` — `buildTable()` method

Add `restitution: 0.3` to the physics options of all wall rectangles (borders, bottom plates, launch lane divider, launch lane stop, funnel guides).

### 5. Remove flipper sync from `update()`

**File:** `src/scenes/GameScene.js` — `update()` method

Delete the flipper setPosition/setAngle sync block (lines 447-461). The physics engine handles all flipper positioning through the constraint system.

## Files Changed

| File | Changes |
|------|---------|
| `src/scenes/GameScene.js` | All five changes |

## What Does Not Change

- Ball spawning, launch mechanics, charging, relaunch detection
- Bumper scoring, collision callbacks, visual feedback
- Lives, drain detection, game over flow
- Launch lane closure wall
- Power bar UI
- Touch controls (same input handlers, different flipper methods)
- Background rendering, decorative shapes
- World bounds safety net
- Velocity clamp

## Verification

1. **Hitbox accuracy** — Roll the ball near the flippers without visually touching them. No reaction. Ball only responds to visually overlapping contacts.
2. **Stationary flipper** — Drop a ball onto a resting flipper. Ball bounces slightly (restitution 0.2) then slides/rolls off. No rocket effect.
3. **Active flipper** — Time a flipper press to hit the ball. Ball receives upward momentum proportional to flipper swing speed. Responsive, not explosive.
4. **Wall bounce** — Ball deflects off walls with slight bounce (restitution 0.3). Feels natural, does not gain energy from wall contacts.
5. **Sprite-body alignment** — Flipper sprites and physics bodies are visually identical at all angles. No visible offset.
6. **Regression** — Bumper scoring (popups + sound), lives (3 lives, drain -> respawn), game over flow, launch mechanics, touch controls, launch lane closure all still work.
