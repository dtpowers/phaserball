# Physics Tweaks & Bug Fixes

## Summary

Seven changes across launch pacing, flipper physics, table geometry, and collision accuracy.

## Changes

### 1. Faster launch charge rate (~20%)

- `LAUNCH.chargeRate`: `0.5` → `0.6`
- Effect: full charge in ~5.6s instead of ~6.7s

### 2. Stronger launch velocity (~25%)

- `LAUNCH.velScale`: `0.005` → `0.00625`
- Effect: max launch y-velocity increases from ~15 to ~18.75 px/frame

### 3. Flipper physics: static bodies → dynamic bodies with constraint pivots

Current: `isStatic: true` flipper bodies synced via `setPosition`/`setAngle` each frame. Static bodies have zero velocity, so ball-flipper collisions only use restitution — no "whack."

New:
- Each flipper gets a `Matter.Constraint` (world constraint, length=0, stiffness=0.9) pinned at the pivot point, offset to the flipper end
- Flipper body is dynamic (has mass), transfers real momentum to ball on impact
- Position/angle still driven by Phaser tween each frame via `Matter.Body.setPosition()` and `Matter.Body.setAngle()`
- Flipper body restitution: `1.0` (unchanged)
- Constraint config: left pivot at `(121.6, 820)`, right pivot at `(514.4, 820)`
- Left flipper constraint: `worldConstraint(body, 0, 0.9, { pointA: { x: 121.6, y: 820 }, pointB: { x: -78, y: 0 } })` (pins left end of 156px body)
- Right flipper constraint: `worldConstraint(body, 0, 0.9, { pointA: { x: 514.4, y: 820 }, pointB: { x: 78, y: 0 } })` (pins right end of 156px body)

### 4. Flipper visual-to-physics 1:1 match

- Flipper texture: 120×28 → **156×28** (wider to reach funnel)
- Physics body: 120×28 → **156×28** (matches texture exactly)
- Origin alignment: left flipper origin `(0, 0.5)`, right flipper origin `(1, 0.5)` — unchanged
- Body center offset from pivot: `width/2 = 78px`

### 5. Launch lane closure wall

Trigger: ball crosses `y < 520` while `x > 620` (in launch lane).

Wall:
- Slanted static rectangle: center `(656, 510)`, size 75×16, angle -15.5°
- Connects launch lane divider `(620, 520)` to right outer wall `(692, 500)`
- Slants upward toward the right wall so balls roll off rather than stick
- Created once per ball, destroyed on `spawnBall()`
- Tracked via `this.launchClosureBody`

### 6. Funnel collision body thickness

- Funnel rectangles: thickness `8px` → `16px`
- Same length (421px) and angles — only thickness changes
- Prevents ball clipping through thin collision surfaces at high velocity

### 7. Flipper-to-funnel positioning

Move flippers outward so outer edges touch funnel walls at y=820:

| | Current | New |
|---|---|---|
| Flipper width | 120px | 156px |
| Left flipper pivot x | 158 | 121.6 |
| Right flipper pivot x | 478 | 514.4 |
| Left flipper sprite position | (158, 820) | (121.6, 820) |
| Right flipper sprite position | (478, 820) | (514.4, 820) |
| Left flipperBody center | (218, 820) | (199.8, 820) |
| Right flipperBody center | (418, 820) | (436.2, 820) |
| Inner edge gap | 80px | 80px (unchanged) |
| Outer edge to funnel | ~78px gap | 0 (touching) |

Rest/active angles unchanged: left rest 20°/active -30°, right rest -20°/active 30°.

Tween duration unchanged: 60ms active, 120ms rest.

## Files Changed

| File | Changes |
|------|---------|
| `src/scenes/BootScene.js` | Flipper texture width 120→156 |
| `src/scenes/GameScene.js` | All other changes |

## Verification

1. Launch charge: hold Space, verify full charge in ~5.6s
2. Launch velocity: max power launch should clear the lane in one shot
3. Flipper hit: ball should receive strong upward momentum from flipper contact
4. Flipper visual: physics body should match sprite exactly (no visible mismatch)
5. Launch closure: ball exits lane → wall appears, ball cannot re-enter
6. Funnel: ball should bounce off or roll down, never clip through
7. Flipper-funnel gap: ball should not pass between flipper outer edge and funnel
