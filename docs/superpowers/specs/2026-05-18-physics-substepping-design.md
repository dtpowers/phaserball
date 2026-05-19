# Physics Sub-stepping for Ball Clipping Prevention

## Problem

The ball clips through the corner deflector and flipper tips at high speeds. This is **tunneling** — the ball moves farther in a single physics frame than the collision shape can intercept, so Matter.js misses the contact entirely.

At max speed (150 px/s) and 60fps, the ball travels ~2.5px per frame. Flipper tips are ~4px thick and the corner deflector is a 16px rectangle at 45°. At narrow contact angles, 2.5px of displacement is enough to pass between collision checks.

## Approach

**Preventive physics change:** enable Matter.js sub-stepping. Divide each 16ms physics frame into 4 sub-steps of 4ms each. The ball's displacement per collision check drops to ~0.6px — well below the thinnest collision geometry.

## Design

### Change

Set `timing.subStep = 4` on the Matter.js engine in `GameScene.create()`:

```js
this.matter.world.update60Hz();
this.matter.world.engine.timing.subStep = 4;
```

One line. No other code changes needed.

### Why Sub-stepping

- Each sub-step runs the full Matter.js pipeline: broadphase → narrowphase → solver
- Ball displacement per step: 150 px/s ÷ 240 steps/s = 0.625px — below all collision geometry thicknesses
- Industry-standard approach for pinball physics simulation
- No special-case code per table element

### What Does NOT Change

- Visual frame rate remains 60fps
- Flipper tween timing (42ms active / 84ms rest) unchanged
- Ball velocity clamp (150 px/s) unchanged
- Input handling, scoring, lives — all unchanged

### CPU Cost

4× physics work per frame. Current body count: 1 dynamic ball + ~20 static bodies (walls, bumpers, flippers, deflector, funnel). Matter.js processes this in well under 1ms total, so 4 sub-steps remain under 4ms — well within the 16ms frame budget.

## Verification

1. Max-power launch toward corner deflector → ball bounces, does not clip through
2. Fast-descending ball + flipper press → ball deflects off flipper tip
3. No regression: relaunch, drain detection, game over flow all intact
