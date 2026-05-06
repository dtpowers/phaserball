---
name: Bug Fixes — Flipper Physics, Launch Lane Gravity, Play Area Centering
description: Fix ball disappearing on flipper contact by adding Matter.js physics bodies to flippers, fix launch lane floating ball with gravity+relaunch, and center all play elements around the actual play area instead of the full canvas
type: project
---

# Bug Fixes — Flipper Physics, Launch Lane, Play Area Centering

## Problems

1. **Ball disappears on flipper contact** — Manual velocity impulses (`+/-200, -600` px/step) in `update()` cause the ball to reach extreme speeds and tunnel through walls, becoming invisible/off-screen.

2. **Launch lane floating ball** — When launch power isn't enough to exit the launch lane, the ball floats mid-air where velocity runs out. No relaunch is possible.

3. **Play area not centered** — All elements (flippers, funnel, drain gap) are centered at x=350 (full canvas center), but the actual play area spans x=16 to x=620 (launch lane excluded), centering at x=318.

## Root Causes

1. Current flipper collision ([GameScene.js:398-425](src/scenes/GameScene.js#L398-L425)) uses manual distance checks and raw `setVelocity()` calls. Values of 200-600 px/step are orders of magnitude higher than the launch velocity (5-15 px/step), causing instant tunneling.

2. Charging disables global gravity ([GameScene.js:197](src/scenes/GameScene.js#L197)). When a weak launch doesn't clear the lane, the `update()` check ([GameScene.js:428-434](src/scenes/GameScene.js#L428-L434)) zeroes velocity mid-fall and resets state, but doesn't allow re-entry to charge mode.

3. All x-coordinates calculated relative to canvas center (x=350) rather than play area center (x=318).

## Fixes

### Fix 1: Physics-based flippers (Matter.js bodies + constraints)

Replace manual flipper collision with full Matter.js physics bodies driven by constraint tweens, following the pattern from [amandafager/pinball](https://github.com/amandafager/pinball).

**Per-flipper structure:**
- **Flipper body** — a Matter.js rectangle (120x28px, matching the sprite) with restitution ~0.5 and low friction
- **Static pivot** — a small static circle at the flipper's rotation point
- **Pin constraint** — connects pivot to flipper body at length=0, stiffness=0.9 (allows rotation)
- **Piston constraint** — connects flipper body near the tip to a fixed point above; tweening its length drives flipper angle

**Flip activation:** Tween piston constraint length shorter → flipper rotates up to active angle
**Flip release:** Tween piston constraint length longer → gravity returns flipper to rest angle

**Remove:** All manual flipper collision code from `update()` (lines 398-425). Matter.js handles ball-flipper collision naturally.

**Safety:** Add a ball velocity cap (e.g., `Math.max(body.velocity.x, body.velocity.y) > 500 → clamp to 500`) in `update()` to prevent any tunneling edge case.

**Flipper positions (after centering fix):**
- Left pivot: (158, 820), origin (0, 0.5), extends rightward
- Right pivot: (478, 820), origin (1, 0.5), extends leftward

### Fix 2: Launch lane gravity + relaunch

**Behavior:**
- **Charging:** Gravity off (existing behavior) — ball stays at bottom of launch lane
- **Launch release:** Gravity on, ball shoots upward with leftward x-velocity to aim out of lane
- **Ball falls back into lane:** When ball.x > 620, ball.y > 520, and velocity.y > 0 (falling), set `ballLaunched = false`. Do NOT zero velocity — let gravity carry the ball to the bottom.
- **Re-charge:** When `ballLaunched === false` and the ball is in the launch lane (x > 620, y > 800), pressing Space re-enters charge mode (gravity off, ball held at bottom).

**Addition:** Add a small static stop block at the bottom of the launch lane (x=660, y=1020, w=50, h=16) so the ball rests at the bottom instead of falling through the drain gap.

### Fix 3: Center play area elements around x=318

Play area: x=16 (left wall) to x=620 (launch lane divider), center = (16+620)/2 = 318.

**Position changes (old → new):**

| Element | Old | New |
|---------|-----|-----|
| Drain gap center | x=350 | x=318 |
| Bottom left wall end | x=326 | x=294 |
| Bottom right wall start | x=374 | x=342 |
| Left funnel bottom tip | x=326 | x=294 |
| Right funnel bottom tip | x=374 | x=342 |
| Left flipper pivot | x=190 | x=158 |
| Right flipper pivot | x=510 | x=478 |

**Recalculated geometry:**
- Bottom left wall: spans x=16..294 → `rectangle(155, 1016, 278, 16)`
- Bottom right wall: spans x=342..684 → `rectangle(513, 1016, 342, 16)`
- Left funnel: (16,700) → (294,1016), midpoint (155, 858), length ~424px
- Right funnel: (620,700) → (342,1016), midpoint (481, 858), length ~442px
- Flippers centered at x=318: left at x=158, right at x=478 (160px from center each)

**Visual wall outlines** updated to match new physics positions.

**Bumpers:** No change — upper play area elements already look balanced.

## Files Changed

| File | Change |
|------|--------|
| `src/scenes/GameScene.js` | All three fixes |

## Testing

1. **Flipper physics:** Ball hits flipper → bounces naturally, no disappearance. Try repeated rapid hits.
2. **Launch lane:** Weak launch → ball rises, falls back, rests at bottom. Press Space → re-charge and launch again.
3. **Centering:** Visual inspection — flippers, funnel, drain gap all centered in the play area (not the full canvas).
4. **Regression:** Bumper scoring, lives, game over flow all still work.
