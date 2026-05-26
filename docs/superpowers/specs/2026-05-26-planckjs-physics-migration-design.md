# Planck.js Physics Migration Design

**Date:** 2026-05-26
**Status:** Approved

## Overview

Migrate the physics engine from Matter.js (Phaser built-in) to Planck.js (Box2D port) to gain continuous collision detection (CCD) and resolve persistent high-speed tunneling issues: corner tunneling, wall sticking, and flipper-tip clipping.

## Decisions

- **Scale conversion:** Internal meter-scale physics (SCALE = 100 px/m), convert to/from pixels when syncing to Phaser sprites. Box2D requires meter-scale (0.1-10m) for solver stability.
- **Flipper control:** RevoluteJoint with motor, physics body is authoritative, visual sprite synced from body angle each frame.
- **Background shapes:** Keep hand-rolled frame-based physics. Decorative only, no game interaction, no benefit from migration.
- **Approach:** Standalone Planck.js world with full per-frame sync to Phaser sprites. Clean separation, full feature access.

## Architecture

### Scale Layer

A `SCALE` constant (100 pixels = 1 meter) with `toM()` / `toPx()` conversion utilities. Table resolution 700x1050 px becomes ~7.0x10.5m in physics space.

```
toM(px) = px / SCALE
toPx(m) = m * SCALE
```

### PhysicsWorld Wrapper

New `PhysicsWorld` class (or module-level functions) wrapping `planck.World`:

- Created in `GameScene.create()`, stored as `this._world`
- Gravity: `{ x: 0, y: 10 }` (meters/s, +Y = down to match Phaser coordinate system) — disabled during launch charge, restored on fire
- Coordinate system: Phaser uses Y-down (Y increases downward), Planck/Box2D defaults to Y-up. We use Y-down to avoid inverting all position sync. Angles: positive = clockwise in Y-down (opposite of Box2D default).
- Stepped each frame in `update()`: `world.step(1/60, 10, 8)`
- Bodies created with user data storing Phaser sprite/game object references
- Contact events via `world.on('begin-contact', ...)`

### Physics Bodies

| Body | Type | Shape | Key Properties |
|------|------|-------|----------------|
| Ball | Dynamic | Circle (r=0.16m) | `bullet: true` (CCD), restitution 0.3, friction 0 |
| Walls | Static | Box | restitution 0.3, angled bodies use `setAngle()` |
| Bumpers | Static | Circle (r=0.36m) | restitution 1.56, user data: {points, type, sprite} |
| Flippers | Dynamic | Polygon (17-vertex tapered) | restitution 0.3, friction 0.4, connected via RevoluteJoint |
| Launch closure | Static | Box (0.75x0.16m) | angle -15.5°, created/destroyed per current logic |

### Flipper Revolute Joint

Each flipper connected to a ground (static) body via `RevoluteJoint`:

- **Pivot:** World anchor at pivot point (converted to meters)
- **Limits:** `enableLimit: true`, angle range constrains rest-to-active travel (~±20° to ±30°)
- **Motor:** `enableMotor: true`, `motorSpeed` set on press (fast toward active), reset on release (return to rest)
- **Torque:** `maxMotorTorque` tuned for responsive feel (~10-20 N*m, to be tested)
- Visual sprite angle synced from `flipperBody.getAngle()` each frame in `update()`

### Collision Detection

Replace `this.matter.world.on('collisionstart')` with `this._world.on('begin-contact')`. Callback extracts fixtures, checks user data for bumper info, triggers score/sound/visual popup. Same game logic, Planck API.

### Velocity Clamp

Post-step velocity clamp on ball body to prevent tunneling from bumper restitution spikes. After `world.step()`, read `ballBody.getLinearVelocity()`, clamp if speed exceeds threshold. No Verlet integration concern — Box2D uses standard velocity integration.

### Position Safety Net

Removed. Planck.js CCD (bullet bodies) eliminates the need for position clamping. If needed as fallback, use `body.setTransform(pos, angle)` which safely sets both position and angle without Verlet artifacts.

### Game Mechanics Mapping

| Current (Matter.js) | New (Planck.js) |
|---------------------|-----------------|
| `this.matter.add.rectangle()` | `world.createBody({type:'static'})` + `createFixture({shape: new Box()})` |
| `this.matter.add.circle()` | `world.createBody({type:'static'})` + `createFixture({shape: new Circle()})` |
| `this.matter.add.fromVertices()` | `world.createDynamicBody()` + `createFixture({shape: new Polygon()})` |
| `this.matter.add.image()` | `world.createDynamicBody()` + Phaser `add.image()` created separately |
| `this.matter.add.worldConstraint()` | `world.createJoint(new RevoluteJoint(...))` |
| `this.matter.world.setGravity()` | `this._world.setGravity()` |
| `ball.body.velocity.x` | `ballBody.getLinearVelocity().x` |
| `Matter.Body.setPosition()` | `body.setTransform(pos, angle)` |
| `Matter.Events.on(engine, 'afterUpdate')` | After `world.step()` in `update()` |
| `matter.world.on('collisionstart')` | `world.on('begin-contact')` |

## Files to Modify

- `src/main.js` — Remove Matter.js physics config
- `src/scenes/GameScene.js` — Complete physics layer rewrite
- `package.json` — Add `planck` dependency

## Files NOT to Modify

- `src/scenes/BootScene.js` — Asset loading unchanged
- `src/scenes/GameOverScene.js` — No physics reference
- `index.html` — No physics reference
- `vite.config.js` — No physics reference

## Out of Scope

- Background decorative shapes (remain hand-rolled)
- Score/lives/game over logic (unchanged, reads from synced positions)
- Visual rendering (Phaser sprites remain, only physics sync changes)
- Asset pipeline (unchanged)
- Input handling (unchanged, flipper input now drives joint motor instead of tween)

## Risks & Mitigations

1. **Motor torque tuning** — Flipper feel may differ from current tween approach. Mitigation: iterate on `maxMotorTorque` and `motorSpeed` values to match current responsiveness (42ms active, 84ms rest).
2. **Scale conversion bugs** — Easy to miss a toM/toPx conversion. Mitigation: centralize conversion in helper functions, verify all body definitions.
3. **Polygon vertex order** — Box2D expects CCW vertex order; Matter.js may differ. Mitigation: verify flipper polygon vertices are CCW in Planck coordinate space.
4. **Coordinate system** — Planck/Box2D uses Y-up; Phaser uses Y-down. Gravity and angles need sign inversion. Mitigation: test early with ball drop.
