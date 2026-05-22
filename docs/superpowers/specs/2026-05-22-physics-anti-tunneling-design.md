# Physics Anti-Tunneling — Multi-Layer Defense

## Problem

Three high-speed physics edge cases persist despite existing mitigations (`subStep = 8`, `positionIterations = 10`, velocity clamp at 150 px/s, `afterUpdate` position clamp):

1. **Top-right corner tunneling** — At max launch power, ball clips through the extended corner deflector (45-degree angled wall)
2. **Wall sticking at high speed** — Ball becomes stuck inside a wall after high-speed collision instead of bouncing out
3. **Flipper tip clipping** — Ball clips through flipper tips at high speeds, especially near the narrow tapered end (~4px effective thickness)

**Root cause**: Matter.js uses discrete collision detection — it checks for overlaps at each sub-step. When the ball's displacement per sub-step approaches or exceeds the thickness of a collision shape, the engine can miss the contact entirely. At 150 px/s and 8 sub-steps (480 Hz), displacement per step is ~1.9px — close to the flipper tip's 4px effective thickness at oblique angles.

## Approach

Four-layer defense, each layer addressing a different failure mode:

| Layer | Technique | Addresses |
|-------|-----------|-----------|
| 1 | Sweep-based pre-collision (CCD approximation) | Tunneling through any shape |
| 2 | Thicken thin geometries | Flipper tip and corner deflector tunneling |
| 3 | Increase sub-stepping (8 → 16) | General tunneling reduction |
| 4 | Proactive penetration resolution | Wall sticking |

## Design

### Layer 1: Sweep-Based Pre-Collision (CCD Approximation)

**What**: Each frame in `update()`, cast a ray from the ball's previous physics position (`body.positionPrev`) to its current position (`body.position`) against all wall and flipper bodies using `Matter.Query.ray()`.

**When**: Every frame the ball exists and has non-zero velocity. No exclusion for launch lane — the launch is precisely when high-speed tunneling occurs.

**Against what**: Wall bodies and flipper physics bodies. Excludes bumpers (thick circles, 72px diameter at scale — tunneling through them at current speeds is unlikely).

**On hit**:
1. Compute the intersection point along the ray
2. Push the ball to the intersection point offset by `BALL.RADIUS + 2px` along the collision normal (away from the penetrated body)
3. Update `positionPrev` to match the new position (preserves Verlet integration integrity)
4. Reflect velocity off the collision normal: `v = v - 2 * (v · n) * n`, then scale by 0.9 restitution

**Implementation**: New method `checkTunneling()` called in `update()` after flipper sync. Stores a reference list of bodies to query against (built in `buildTable()` and `buildFlippers()`).

### Layer 2: Geometry Thickening

**Flipper tip** (17-vertex polygon):
- Current tip: `{x:78, y:0}` with neighbors at `{x:72, y:±4}` — effective thickness ~8px at tip, ~4px at narrowest tapered section
- Change: Widen the tapered tip section — change `{x:72, y:±4}` to `{x:72, y:±6}`, and add rounded cap vertex `{x:80, y:0}`
- New tip thickness: ~12px at tip, ~8px at narrowest — 50% increase
- At `FLIPPER.SCALE` (156/1224 ≈ 0.1277), this is ~1.5px visual difference — imperceptible

**Corner deflector** (angled rectangle):
- Current: 16px thick (`this.matter.add.rectangle(628, 88, 204, 16, ...)`)
- Change: 24px thick — center y-offset adjusted along the deflector's normal to maintain outer edge alignment
- Visual line (4px stroke) unchanged — only the collision shape thickens

### Layer 3: Sub-stepping Increase

- `engine.timing.subStep`: 8 → 16
- Per-sub-step displacement at max speed: 150 px/s ÷ (60 fps × 16) = 0.94px
- Below all collision geometry thicknesses (thinnest: 8px flipper tip after thickening)
- Add explicit `engine.velocityIterations = 10` (currently using Matter.js default of 6; higher helps resolve velocity conflicts in multi-contact scenarios)

**CPU cost**: 16 sub-steps × ~20 bodies ≈ 320 collision checks per frame. Matter.js processes this in ~2-3ms on modern hardware, well within the 16.6ms frame budget.

### Layer 4: Proactive Penetration Resolution

**What**: Extend the existing `afterUpdate` callback. After the velocity clamp and escape clamp, add a penetration check against all wall bodies.

**How**: For each wall body, check if the ball center is within `BALL.RADIUS + wall_half_thickness + 2px` of the wall's collision surface. If penetrating:
1. Compute penetration depth and normal
2. Push ball out along the normal by penetration depth + 2px margin
3. Update `positionPrev` for Verlet integrity
4. Preserve outgoing velocity component (do not zero — this distinguishes from the existing escape clamp which reverses velocity)

**Effect**: Directly prevents wall sticking by ensuring the ball is never inside a wall between physics steps. Also eliminates the need for the 2-second "stuck in funnel corner" timeout fallback.

## What Does Not Change

- Ball MAX_SPEED (150 px/s) — unchanged
- Bumper implementation and restitution (1.56) — unchanged
- Flipper tween timing (42ms active / 84ms rest) — unchanged
- Flipper sync pattern (setPosition + setAngle with updateVelocity=true) — unchanged
- Launch mechanics, scoring, lives, game over flow — unchanged
- Visual wall outlines (8px stroke) — unchanged
- Visual funnel lines (4px stroke) — unchanged

## Files Changed

- `src/scenes/GameScene.js` — all four layers implemented in this single file
  - `buildTable()` — corner deflector thickness
  - `buildFlippers()` — flipper vertex adjustment
  - `create()` — engine tuning (subStep, velocityIterations), body reference list
  - `update()` — new `checkTunneling()` call
  - `afterUpdate` callback — penetration resolution addition
  - New method: `checkTunneling()`

## Verification

1. Max-power launch toward top-right corner → ball bounces off deflector, does not clip through
2. Max-power launch, ball descending at high speed + flipper press → ball deflects off flipper tip
3. Ball colliding with wall at high speed → bounces out, does not stick
4. No regression: relaunch, drain detection, game over flow, scoring all intact
5. Performance: browser dev tools show frame time < 16ms during active play
