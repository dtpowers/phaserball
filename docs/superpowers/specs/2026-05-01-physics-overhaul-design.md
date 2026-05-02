---
name: Physics Overhaul — Arcade to Matter.js Migration
---

# Physics Overhaul — Arcade to Matter.js Migration

## Problem

Four interrelated bugs stem from the hybrid Arcade physics + manual collision approach:

1. **Ball gets stuck during launch** — `checkFunnelCollision()` fires every frame regardless of ball position. The right funnel line endpoint (620, 700) is close enough to the launch lane that the 20px collision radius pushes the ball sideways, trapping it.
2. **Ceiling and floor walls are much thicker than side walls** — `buildHorizontalWall()` places wall tiles at 4px spacing while side walls use 32px vertical stepping with 4px-wide tiles. The dense tile placement creates a visually thick wall.
3. **Ball feels dead** — `setBounce(0.4)` with no bumper velocity boost gives a dull, underwhelming bounce. No friction/drag tuning on the ball body.
4. **Re-launch only works once** — `hasFallenBackOnce` flag allows a single re-launch. Second failure leaves the ball stuck forever.

## Root Cause

Arcade physics only supports axis-aligned rectangle and circle bodies. Diagonal funnel walls require either tile approximation (visually inconsistent) or manual collision in `update()`. Manual funnel collision runs unconditionally, causing interference in the launch lane. The hybrid system is the fundamental issue.

## Solution

Migrate from Arcade physics to Matter.js. Matter supports rotated static bodies natively, proper restitution-based bounce, and is proven for pinball (reference: amandafager/pinball). This eliminates the hybrid collision anti-pattern entirely.

## Architecture

### Physics Engine

- **Before:** `default: 'arcade'` with `this.physics.add.*` API and explicit `collider()` calls
- **After:** `default: 'matter'` with `this.matter.add.*` API, automatic body-body collision resolution

Config change in `src/main.js`:

```js
physics: {
  default: 'matter',
  matter: {
    gravity:    { y: 1 },       // ~equivalent to arcade y=600
    enableSleeping: false,      // keep ball responsive
    setBounds:   false          // we define our own bounds
  }
}
```

### Walls — Uniform Static Rectangles

Replace tile-based walls with single static rectangles. All walls use 16px thickness for visual uniformity:

| Wall | Position (x, y) | Size (w × h) | Rotation |
|------|-----------------|--------------|----------|
| Left | (8, 525) | 16 × 1050 | 0° |
| Right | (692, 525) | 16 × 1050 | 0° |
| Top | (350, 8) | 700 × 16 | 0° |
| Bottom Left | (145, 1016) | 260 × 16 | 0° |
| Bottom Right | (555, 1016) | 260 × 16 | 0° |
| Launch Lane Divider | (620, 768) | 16 × 512 | 0° |

Created via `this.matter.add.rectangle(x, y, w, h, { isStatic: true })`.

### Funnel — Rotated Static Rectangles

Two thin rotated rectangles, positioned at the midpoint of each funnel diagonal:

| Funnel | Position (x, y) | Size (w × h) | Rotation |
|--------|-----------------|--------------|----------|
| Left | (145, 858) | 340 × 8 | ~62.7° |
| Right | (522, 858) | 340 × 8 | ~-62.7° |

Created via `this.matter.add.rectangle(x, y, w, h, { isStatic: true, angle: radians })`.

### Bumpers — Static Circles with High Restitution

Each bumper is a static circle with `restitution: 1.2` for energetic bounce:

```js
const bumper = this.matter.add.circle(x, y, 28, {
  isStatic: true,
  restitution: 1.2
});
bumper.setData('points', points);
bumper.setData('type', type);
```

Collision callback attached via Matter `collisionstart` event for scoring, audio, and visual feedback.

### Ball — Tuned Circle Body

```js
this.ball = this.matter.add.circle(652, 950, 16, {
  restitution: 0.8,       // bouncy but not rubbery
  friction:    0,         // no surface friction
  frictionAir: 0.0001,    // minimal air drag
  density:     0.001      // low mass for energetic response
});
```

### Flipper Collision — Manual (Unchanged)

Flippers use tween-based rotation — Matter body rotation tracking with tweens is unreliable. Keep existing manual distance-based collision in `update()`. Velocity setters use Matter API (`this.ball.setVelocityX/Y()`).

### Re-Launch — Unlimited Retries

Replace `hasFallenBackOnce` flag with unconditional launch-lane detection:

```js
if (this.ball.x > 620 && this.ball.y > 520 && this.ball.body.velocity.y > 0) {
  this.ballLaunched = false;
  this.isCharging = false;
  this.launchPower = 0;
  this.ball.setVelocity(0, 0);
}
```

User can keep launching until the ball escapes the launch lane.

## Files Changed

| File | Change |
|------|--------|
| `src/main.js` | Physics config: arcade → matter |
| `src/scenes/GameScene.js` | Major refactor: all physics API calls, wall/funnel/bumper/ball creation, collision handling, re-launch logic |
| `src/scenes/BootScene.js` | No changes |
| `src/scenes/GameOverScene.js` | No changes |

## What Stays the Same

- Visual rendering (graphics, textures, decorative shapes)
- Score display, lives display, high score persistence
- Input handling (keyboard + touch)
- Flipper tween animation
- Audio SFX pipeline
- Game state flow (spawn → launch → play → drain → respawn → game over)

## Testing

1. Ball launches cleanly without getting stuck
2. Ball bounces energetically off bumpers with satisfying force
3. Ball bounces naturally off walls (not too bouncy, not too dull)
4. Funnel guides ball toward drain gap correctly
5. Ceiling and floor walls match side wall thickness visually
6. Re-launch works unlimited times while ball stays in launch lane
7. Re-launch works when ball falls back from play area during gameplay
8. All 3 lives drain and respawn correctly
9. Game over flow works

