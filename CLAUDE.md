# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Earkandi Pinball — a statically-hostable 2D pinball game themed around the [earkandi](https://earkandi.net/) brand, built with Phaser 3 and Vite. Fully implemented and playable.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run gen-sfx   # Generate audio SFX files (scripts/gen-sfx.js)
```

## Architecture

**Vite config** ([vite.config.js](vite.config.js)): `root: '.'`, `publicDir: 'public'`, build outputs to `dist/assets`. ES module project (`"type": "module"` in package.json). Dependencies: `phaser@^3.80.1`, `planck@^1.5.0` (physics). DevDependencies: `vite@^5.4.0`, `sharp@^0.34.5` (image processing), `@playwright/test@^1.60.0` (browser testing).

**Three Phaser scenes:**
- **BootScene** — Loads 3 audio SFX + 4 custom bumper PNG sprites + flipper PNG sprite, then procedurally generates remaining visual assets (ball, 3 UI buttons) via Phaser Graphics + `generateTexture()`. Starts GameScene.
- **GameScene** — Main gameplay: table walls, bumpers, flippers, ball physics, scoring, lives, input, launch power bar.
- **GameOverScene** — Overlay (launched via `scene.launch()`, then GameScene is stopped). Receives `{ score, highScore }` via `create(data)`. Shows final score, high score, a pulsing tween on the high score *value* text when `score >= highScore`, restart button that stops GameOverScene then calls `scene.start('GameScene')`.

**Game config** ([src/main.js](src/main.js)): Resolution 700×1050 (portrait), `Phaser.Scale.FIT` with `CENTER_BOTH`, `physics: false` (physics handled by Planck.js standalone world), 3 active pointers for multi-touch, `disableContextMenu: true` for mobile.

**Entry point:** `index.html` mounts Phaser into `#game-container` (wrapped in `#game-wrapper` flex column for responsive layout), imports `src/main.js` as module. CSS prevents scroll/zoom on mobile. Uses **Fredoka One** Google Font for HUD labels.

**HTML overlay for HUD:** Score, lives, and high score rendered as HTML elements in `#game-header` (layout: HI SCORE left, SCORE center, LIVES right). Labels ("SCORE:", "HI SCORE:") use `.hud-label` class for animated rainbow color cycle. Element IDs updated from scenes via `document.getElementById()` — NOT drawn in Phaser:
- `#score-value` — current score number; JS toggles `.score-pop` class on increase to trigger shake animation
- `#hi-value` — high score number; updated on game start and on new high score
- `#lives-display` — lives icons; set via `'⚪'.repeat(lives)`

Responsive via `clamp()` font sizes.

### Physics (Planck.js)

Physics uses Planck.js (Box2D JavaScript port) via a standalone world, NOT Phaser's built-in Matter.js. Import: `import * as planck from 'planck';` ([GameScene.js:2](src/scenes/GameScene.js#L2)). Phaser config has `physics: false`.

**Scale conversion:** `SCALE = 100` (100 px = 1 m), with `toM(px)` / `toPx(m)` helpers. Box2D requires meter-scale (~0.1–10 m) for solver stability. All physics constants are defined in **MKS units** (meters, m/s, kg/m³). Visual sprites are created in pixel space and synced from body positions each frame via `toPx()`.

**World:** `this._world = new planck.World({ gravity: { x: 0, y: GRAVITY_Y } })` (Y-down to match Phaser), stepped each frame in `update()`: `world.step(1/60, 10, 8)`. In `create()`, the world **must** be instantiated before `buildTable()` since `buildTable()` calls `_world.createBody()`. `GRAVITY_Y = 5` (NOT 9.8): a real pinball playfield is tilted only ~6.5°, so the ball's down-table acceleration is `g·sin(6.5°) ≈ 1.1 m/s²`; full vertical gravity makes the ball plummet (feels heavy *and* fast). 5 is a middle ground — weighty/controllable but lively. It's a single constant used in all three places gravity is (re)set (world creation, end of `buildFlippers()`, and `releaseCharge()`).

- **Walls** — Static `planck.Box` bodies, restitution 0.3, friction 0.4. All positions/sizes in meters. Includes left/right/top borders, bottom plates (gap for drain), launch lane divider, launch lane bottom stop, two funnel guides (angled via `Phaser.Math.Angle.Between()`), and corner deflector (45°). Wall visuals drawn as 8px stroke outlines via Graphics in pixel space.
- **Bumpers** — Static `planck.Circle` bodies (r=0.36 m), restitution **1.0** (elastic — lively bounce that does NOT inject energy). It was 1.25, which added 25% speed on every hit and rocketed the ball to the velocity clamp — the main cause of the "too fast" feel. Keep bumper restitution ≤ 1.0. Fixture userData stores `{id, points, type, sprite}` — `id` is a sequential integer starting at **0**, used for collision debouncing. Collision detected via `this._world.on('begin-contact')`, and `_getBumperFixture()` reads userData directly from the contact fixture (no map iteration). **Important:** the null check must use `data.id === undefined || data.id === null`, NOT `!data.id` — falsy check breaks for id=0 (first bumper), silently dropping all hits on it. Visual sprites are custom 250×250 PNG images scaled to 0.288 (~72px), with pulsing glow overlay.
- **Flippers** — Dynamic polygon bodies (17-vertex tapered shape, vertices defined in meters) connected to ground via `planck.RevoluteJoint` with motor + angle limits. Three motor speeds: `FLIPPER_MOTOR_UP = 18` rad/s (snap to active), `FLIPPER_MOTOR_HOLD = 3` rad/s (hold at active angle), `FLIPPER_MOTOR_DOWN = 12` rad/s (return to rest), `FLIPPER_MAX_TORQUE = 200` N·m. **Asymmetric joint limits so rest = a hard limit:** the body is created at the rest angle (jointAngle 0) and the rest motor drives *toward a limit*, so the rest angle MUST coincide with a limit or the flipper drifts away from where it's drawn. Left fires by decreasing jointAngle → limits `[-FLIPPER_ACTIVE_RAD, 0]` (rest = upper); right fires by increasing → `[0, +FLIPPER_ACTIVE_RAD]` (rest = lower). (Previously both used symmetric ±45°, so rest sat 45° from the drawn angle and the flipper visibly jumped to its true equilibrium on first fire — the "right flipper starts beyond the funnel wall until fired" bug.) Rest angle: ±15° (sign flipped per side so both tilt slightly down). **Mirrored geometry**: left flipper body extends RIGHT from pivot; right extends LEFT. Therefore opposite motor directions produce the same visual tip motion — left: negative motor (CCW) = tip up, right: positive motor (CW) = tip up. State machine in `update()`: fire (motor UP) → hold (motor HOLD at active angle via `upDir * angle >= FLIPPER_ACTIVE_RAD`) → return (motor DOWN to rest). Pivot positions in meters (`PIVOT_X_L: 1.216`, `PIVOT_X_R: 5.144`, `PIVOT_Y: 8.20`). Sprite angles synced from `body.getAngle()` each frame. Sprite loaded from `flipper.png` (1224×417) scaled to `156/1224` (~156px wide, ~53px tall). Right flipper uses same texture with `setFlipX(true)`, and its **collision polygon is mirrored** (`verts.map(v => ({x:-v.x, y:v.y})).reverse()` — negate x, reverse to restore CCW winding) so its thin/pivot end matches the flipped sprite instead of putting the wide/tip end at the pivot. Fixture density: `0.1 kg/m³`.
- **Ball** — Dynamic `planck.Circle` body (r=0.16 m), `bullet: true` (continuous collision detection), restitution 0.5, friction 0, density 0.001 kg/m³, `linearDamping: 0.05`, `fixedRotation: true`. Spawn position in meters (`SPAWN_X: 6.52, SPAWN_Y: 9.50`). Visual sprite created separately via `this.add.image()` and synced from body position each frame. Damping is intentionally **light** (gentle playfield rolling friction): higher values (e.g. 0.2) bleed enough of the low-gravity ball's energy that it dead-stops in pockets/slopes (it got wedged between the left funnel guide and the flipper pivot — recoverable with a flip, but it feels dead).
- **Launch lane closure** — Static `planck.Box` body (0.375×0.08 m, angle -15.5°) spawned when ball exits the lane upward (checked in meters: `pos.x < toM(600) && pos.y < LANE.FUNNEL_Y && vel.y < 0`). Has matching Graphics visual (4px line, color `0x3a3a6a`). Removed on ball respawn.
- **Velocity clamp** — After each `world.step()`, ball velocity clamped to `BALL.MAX_SPEED` (16 m/s) as a top-speed cap / anti-tunneling safety net. Velocity is already in m/s from Planck, compared directly. Box2D uses standard velocity integration (no Verlet), so `setLinearVelocity()` is safe without positionPrev concerns.
- **Gravity control** — During launch charge: `world.setGravity({ x: 0, y: 0 })` (ball floats). On release: `world.setGravity({ x: 0, y: GRAVITY_Y })` (gravity restored).

**Planck.js Gotchas:**

- **Fixture density should be passed in `createFixture()`.** If you call `fixture.setDensity()` after creation, you must also call `body.resetMassData()` to recalculate mass/inertia — Planck.js does not do this automatically. Without mass, dynamic bodies have `invInertia === 0`, which causes RevoluteJoint motors to be skipped entirely by the solver (Box2D's `fixedRotation` path). Always prefer: `body.createFixture(shape, { density: 0.1 })`.
- **`physics: false` disables all Phaser physics methods on sprites.** With no Phaser physics subsystem, sprites have no `setVelocity()`, `body`, or physics-related properties. All motion must be handled through the Planck world — call `planckBody.setLinearVelocity()` on the physics body, then manually sync the Phaser sprite's position/angle in `update()`.
- **All physics constants use MKS units.** Ball speeds, positions, sizes, flipper dimensions, and table boundaries are all in meters/seconds/kg. Pixel values only appear in visual rendering code (Graphics, sprite positions). When adding new physics behavior, define constants in meters and convert to pixels only for visual sync.
- **Flipper motor directions are opposite per side due to mirrored geometry.** Left flipper body extends RIGHT from pivot; right extends LEFT. In Box2D's Y-down system, positive motor = CW rotation. Because of the mirrored geometry, the SAME CW rotation drives the left tip DOWN but the right tip UP. Therefore: left flipper uses negative motor (CCW) to lift, right uses positive (CW). The state machine tracks `upDir` per side (`left: -1, right: 1`) for motor direction and active angle checks. Never unify both flippers to the same motor direction — they must be opposite.
- **A constant-speed motor drives to a joint LIMIT, not to a target angle.** `RevoluteJoint.setMotorSpeed()` just sets an angular velocity; with `enableLimit`, the body coasts until it hits a limit, where the limit constraint holds it. So a flipper's resting pose is defined by *a limit*, not by where the body was created. If the body's initial/drawn angle (jointAngle 0) isn't itself a limit, the motor will move it to the nearest limit on the first frame (`setMotorSpeed` also wakes the body) and the visual will jump. Make rest coincide with a limit (asymmetric limits per side) — see the Flippers entry above.

### Game mechanics

- **Launch:** Hold Space (or touch launch button) to charge — gravity disabled (`_world.setGravity({x:0, y:0})`), power accumulates (`delta * chargeRate`, frame-rate independent), ball velocity zeroed on Planck body. `startCharge()` guards against `!this._ballBody` to prevent crashes during the 1-second respawn delay (body is null between `loseLife()` and `spawnBall()`). Release fires ball with velocity in m/s: `yVel = -(BASE_VEL_Y + launchPower * VEL_SCALE)`, `xVel = VEL_X` (-0.1 m/s leftward drift), clamped to `BALL.MAX_SPEED`. Gravity restored. Launch constants: `MAX_POWER: 2600`, `CHARGE_RATE: 0.9`, `BASE_VEL_Y: 2.0 m/s`, `VEL_SCALE: 0.0042 m/s per power unit` (full charge ≈ 12.9 m/s — clears the lane and top deflector under `GRAVITY_Y`; a light tap dribbles back for a relaunch), `VEL_X: -0.1 m/s`. These are tuned to `GRAVITY_Y` — re-derive if gravity changes.
- **Relaunch:** If ball falls back into launch lane (`pos.x > LANE.DIVIDER_X (6.20m) && pos.y > LANE.FUNNEL_Y (5.20m) && vel.y > 0`), `ballLaunched` resets to false, allowing another charge-and-launch.
- **Velocity clamp:** Ball speed capped at 16 m/s post-`world.step()` in `update()` (top-speed cap / anti-tunneling).
- **Lives:** 3 lives, `isLosingLife` guard prevents double-drain. Ball drain detected when `pos.y > toM(TABLE.H)`. Safety fallback: if launched ball stays below y=980 (converted via `toM()`) for >2s, force drain. On life lost: screen shake (200ms, 0.03 intensity), Planck body destroyed + Phaser sprite destroyed, ball respawned after 1s delay. Lives display initialized in `index.html` and updated via `document.getElementById()`.
- **Game over & restart:** When lives reach 0, high score saved to localStorage (`earkandi_highscore`), GameOverScene launched as overlay, GameScene **stopped** (not paused). PLAY AGAIN calls `scene.start('GameScene')`, which re-runs the full `init`→`create` lifecycle. **Critical:** Phaser reuses the *same scene instance* across restarts, so instance fields survive a restart. The standalone Planck world is NOT a Phaser-managed object, so its bodies must be dropped on teardown — otherwise `create()` builds a new world and `spawnBall()` calls `newWorld.destroyBody(staleBodyFromOldWorld)`, which throws inside Planck's broad-phase, aborts `create()`, and leaves the scene stuck in `CREATING` (no update loop = frozen — this was the long-standing "Play Again doesn't work" bug). Two layers guard this: (1) `create()` clears `this._ballBody`/`this.ball` up front; (2) a `shutdown()` wired via `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)` nulls the Planck world + body refs when the scene stops. **Do NOT** call `super.shutdown()` (Phaser.Scene has no such method) or manually destroy children/tweens in `shutdown()` — Phaser already destroys display objects, tweens, timers, and input on shutdown; doing it yourself races with Phaser's teardown.
- **Scoring:** Star=100, Heart=150, Moon=200, Flower=250. Score popups animate upward and fade on bumper hit. On score increase, JS adds `.score-pop` class to `#score-value`, then removes it on `animationend` to allow re-triggering. The `#score-value` element lives in the DOM (not the scene), so `create()` calls `updateScoreDisplay()` on (re)start to reset it to 0 — otherwise it shows the previous game's score until the first hit.

### Asset pipeline

**Custom bumper sprites:** 4 PNG images (250×250, transparent BG) in `public/assets/images/`: `star.png`, `heart.png`, `moon.png`, `flower.png`. Loaded in BootScene `preload()`, referenced as `bumper-star`, `bumper-heart`, `bumper-moon`, `bumper-flower`. Used by bumpers, background decorative shapes, and GameOverScene.

**Flipper sprite:** `flipper.png` (1224×417 PNG, transparent BG, cropped from original 1536×1024) in `public/assets/images/`. Loaded in BootScene `preload()`, scaled to `156/1224` (~156px wide, ~53px tall) in GameScene. Right flipper uses same texture with `setFlipX(true)`.

**Procedural assets (BootScene `generateAssets()`):** Ball (32×32 white circle), 3 UI buttons (left/right arrow + launch up-arrow).

**Audio:** Generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`): `bumper-hit.wav`, `ball-drain.wav`, `flipper-activate.wav`.

### Controls

- Desktop: A/Left = left flipper, D/Right = right flipper, Space = hold-to-charge launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

### Visual features

Gradient background (dark blue-black top → dark navy bottom) with 15 decorative shapes that float, rotate, and bounce off walls/each other (frame-based physics, not tweens), pulsing glow on bumpers, launch power bar (green→red gradient, only visible while charging; fill scale formula: `(launchPower / MAX_POWER) * 20` to match the 200px background height), score popups on bumper hit, screen shake on life lost, rainbow-animated HUD labels, score pop effect on score increase.

**Phaser API Gotchas:**
- **`fillGradientStyle` signature is `(topLeft, topRight, bottomLeft, bottomRight, alphaTopLeft, alphaTopRight, alphaBottomLeft, alphaBottomRight)`.** Alpha values default to 1 if omitted. Passing extra positional arguments (e.g., width/height) silently maps onto the alpha slots and makes the fill invisible. Always pass exactly 4 colors + up to 4 explicit alpha values.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
