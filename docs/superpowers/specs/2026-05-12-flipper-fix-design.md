# Flipper Fix Design — Restore Tween-Driven Pattern

## Problem

Commit `f5ece4d` replaced the working tween-driven flipper pattern with a constraint-driven piston pattern. This introduced two bugs:

1. **Wrong spawn positions** — physics body centroids and constraint geometry place flippers at incorrect locations, drifting from their expected pivot points.
2. **Gravity sag** — dynamic bodies with insufficient constraint stiffness respond to gravity, causing flippers to flop downward at rest.

## Architecture

**Tween-driven with physics body sync (visual-first pattern).** The visual sprite is the source of truth. Tweening rotates the sprite to active/rest angles. Each frame, the physics body is forced to follow: velocity zeroed, then position/angle set to match the sprite. `fromVertices` tapered trapezoid collision shapes closely match the visual flipper geometry. `worldConstraint` pins each body at its pivot point.

## Component Details

### Left Flipper

- **Sprite**: `this.add.image(121.6, 820, 'flipper')`, origin `(0, 0.5)`, angle 20° at rest, -30° when active
- **Body centroid**: `(199.8, 820)` — that's `121.6 + 78`, midpoint of the 156px flipper
- **Vertices** (relative to centroid): wide end at `x=-78` (pivot side, 28px tall), narrow tip at `x=+78` (8px tall)
- **Constraint**: `worldConstraint` pinning `{x:121.6, y:820}` to body offset `{x:-78, y:0}`

### Right Flipper

- **Sprite**: `this.add.image(514.4, 820, 'flipper')` with `setFlipX(true)`, origin `(1, 0.5)`, angle -20° at rest, 30° when active
- **Body centroid**: `(436.2, 820)` — that's `514.4 - 78`
- **Vertices** (mirrored): wide end at `x=+78` (pivot side, 28px tall), narrow tip at `x=-78` (8px tall)
- **Constraint**: `worldConstraint` pinning `{x:514.4, y:820}` to body offset `{x:+78, y:0}`

### Per-Frame Sync (in `update()`)

```
Matter.Body.setVelocity(body, { x: 0, y: 0 })
Matter.Body.setPosition(body, { x: sprite.x + offset, y: sprite.y })
Matter.Body.setAngle(body, Phaser.Math.DegToRad(sprite.angle))
```

Angular velocity is NOT zeroed — this preserves momentum transfer to the ball on impact.

### Angles

| State  | Left | Right |
|--------|------|-------|
| Rest   | +20° | -20°  |
| Active | -30° | +30°  |

### Tween Timing

- **Activate**: 42ms, `Sine.easeOut`
- **Release**: 84ms, `Sine.easeOut`

## Changes to `buildFlippers()`

- Remove all piston/block/pivot static bodies and piston constraints introduced in `f5ece4d`
- Create `fromVertices` tapered trapezoid bodies for each flipper
- Create `worldConstraint` pin at each pivot
- Right flipper uses `flipper` texture with `setFlipX(true)` instead of a separate `flipper-right` texture
- Set initial sprite angles to match rest position (20° / -20°) to prevent first-frame horizontal flash

## Changes to `flipLeft()` / `flipRight()` / `releaseLeft()` / `releaseRight()`

- Tween the visual sprite `angle` property directly (not piston constraint lengths)
- Activate tweens target `flipperActiveAngle`, release tweens target `flipperRestAngle`
- Play `flipper-activate` sound on flip

## Changes to `update()` flipper sync

- Sync body position/angle from sprite position/angle
- Zero linear velocity before setting position to prevent explosive velocity spikes
- Preserve angular velocity for natural ball momentum transfer

## What Does Not Change

- Bumper implementation, scoring, ball physics, launch mechanics, collision detection, UI, background shapes, game-over flow — all remain untouched
- Pivot coordinates (121.6, 820) and (514.4, 820) remain the same as pre-`f5ece4d`
- Tween durations (42ms active, 84ms release) remain the same

## Verification

- Flippers spawn at correct pivot locations, visually aligned with funnel area
- At rest, flippers point downward toward the drain (±20°)
- Activating a flipper quickly rotates it upward (∓30°)
- Releasing returns to rest position
- No gravity-induced sag or drift
- Ball collisions with flipper tips register correctly (tapered body shape)
- Momentum transfer works — ball gains velocity from active flipper contact
