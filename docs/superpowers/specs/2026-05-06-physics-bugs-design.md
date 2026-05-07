# Physics Bug Fixes — Launch Wall Visual, Flipper Piston Constraints

## Summary

Three fixes addressing issues introduced by the previous physics tweaks: add a visual for the launch lane closure wall, replace the setPosition/setAngle flipper sync with a piston-constraint system for accurate hitboxes and realistic ball reaction, and remove the manual flipper sync from `update()`.

## Problem Statement

### Issue 1: Launch closure wall is invisible

The physics body for the launch lane closure wall was created but has no visual representation. The player cannot see the barrier sealing the launch lane.

### Issue 2: Flipper hitbox does not match visual

The current approach positions the flipper physics body each frame via `Matter.Body.setPosition()` and `Matter.Body.setAngle()`. Because the body is dynamic with a constraint pivot, the teleported body generates incorrect collision impulses — the ball rockets away even when it doesn't visually touch a flipper.

### Issue 3: Flipper ball reaction is unrealistic

The same setPosition/setAngle approach causes the physics engine to compute enormous delta-velocities on the flipper body every frame. When the ball collides, it receives explosive energy regardless of whether the flipper is actually moving. A stationary flipper should behave like a wall (ball slides off), and a moving flipper should transfer momentum proportional to its velocity.

## Changes

### 1. Launch closure wall visual

When the launch closure wall physics body is created in `update()`, a matching Graphics line is drawn. When the wall is destroyed in `spawnBall()`, the Graphics is also destroyed.

- Line style: 4px thick, color `0x3a3a6a` (matches existing wall visuals in `buildTable()`)
- Line endpoints: `(620, 520)` to `(692, 500)` — matches the physics body at center `(656, 510)`, 75px long, -15.5° angle
- Tracked via `this.launchClosureGfx`

### 2. Flipper physics: piston constraints

Replace the entire `buildFlippers()` method and the flipper sync block in `update()`.

**Architecture (per flipper):** Four bodies, two constraints.

1. **Pivot body** — static circle (radius 1) at the pivot point. Invisible (`scale: 0.02`).
2. **Flipper body** — dynamic 156×28 rectangle. Restitution: `0.0`, friction: `0.4`. No manual position/angle updates.
3. **Block body** — static rectangle (10×10) positioned 80px above the pivot. Invisible (`scale: 0.02`). Serves as the piston anchor.
4. **Pin constraint** — between pivot body and flipper body. Locks the distance between the pivot point and one end of the flipper, acting as a rotation axis. Stiffness: `0.9`.
5. **Piston constraint** — between block body and a point on the flipper body above the pivot. Tweening this constraint's `length` property pushes/pulls the flipper. The physics engine computes the resulting velocity naturally.

**Geometry (left flipper):**

| Component | Position | Notes |
|-----------|----------|-------|
| Pivot body | (121.6, 820) | static circle, radius 1 |
| Flipper body | (199.6, 820), angle 20° | dynamic 156×28 rectangle |
| Block body | (121.6, 740) | static 10×10, 80px above pivot |
| Pin constraint | pivot ↔ flipper, pointB: `(-78, 0)` | length auto-calculated at creation |
| Piston constraint | block ↔ flipper, pointB: `(-25, -47)` | rest length: 75.7, active length: 61.3 |

**Geometry (right flipper):**

| Component | Position | Notes |
|-----------|----------|-------|
| Pivot body | (514.4, 820) | static circle, radius 1 |
| Flipper body | (436.4, 820), angle -20° | dynamic 156×28 rectangle |
| Block body | (514.4, 740) | static 10×10, 80px above pivot |
| Pin constraint | pivot ↔ flipper, pointB: `(78, 0)` | length auto-calculated at creation |
| Piston constraint | block ↔ flipper, pointB: `(25, -47)` | rest length: 75.7, active length: 61.3 |

**Sprite attachment:**

The flipper visual sprite is created via `this.matter.add.sprite()` which binds the sprite to the physics body. The sprite automatically follows the body's position and angle. No manual sync in `update()`.

- Left flipper sprite: created at `(199.6, 820)`, origin `(0.5, 0.5)`, texture `flipper` (156×28). Texture center aligns with body center; left edge is at pivot x=121.6.
- Right flipper sprite: created at `(436.4, 820)`, origin `(0.5, 0.5)`, texture `flipper` (156×28). Texture center aligns with body center; right edge is at pivot x=514.4.

The sprite angle matches the body angle (set initially to 20° / -20° for left / right). As the physics engine rotates the body, the sprite rotates with it automatically.

**Input handling:**

`flip()` and `release()` methods tween the piston constraint `length` property:

- **Active (flip):** tween piston length from 75.7 to 61.3 over 60ms. This pulls the flipper upward.
- **Rest (release):** tween piston length from 61.3 to 75.7 over 120ms. This lets gravity and the constraint return the flipper to rest.

**Material properties:**

- Restitution: `0.0` — stationary flipper behaves like a wall, no inherent bounce
- Friction: `0.4` — ball can slide along the flipper surface
- Ball momentum from flipper contact comes entirely from the flipper's physical velocity (computed by the physics engine from the piston tween)

### 3. Remove flipper sync from `update()`

The entire flipper sync block in `update()` (lines 434-449) is removed. The physics engine handles all flipper positioning through the constraint system.

## Files Changed

| File | Changes |
|------|---------|
| `src/scenes/GameScene.js` | All three changes |

## Verification

1. **Launch wall visual:** After the ball exits the launch lane, a neon line should appear connecting `(620, 520)` to `(692, 500)`. Line should disappear on ball respawn.
2. **Flipper hitbox:** Ball should only react when visually touching a flipper. No more "invisible rocket" effect near flipper region.
3. **Stationary flipper:** Drop a ball onto a flipper at rest. Ball should slide off slowly, like it's rolling off a wall. No violent bounce.
4. **Active flipper:** Time a flipper press to hit the ball. Ball should receive upward momentum proportional to the flipper swing speed. Should feel responsive but not explosive.
5. **Flipper visual match:** Physics body should perfectly align with the flipper sprite at all angles. No visible offset.
6. **Regression:** Bumper scoring, lives, launch mechanics, touch controls all still work.
