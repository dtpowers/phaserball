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

**Vite config** ([vite.config.js](vite.config.js)): `root: '.'`, `publicDir: 'public'`, build outputs to `dist/assets`. ES module project (`"type": "module"` in package.json). Dependencies: `phaser@^3.80.1`, `planck@^1.5.0` (physics), `sharp@^0.34.5` (dev, for image processing).

**Three Phaser scenes:**
- **BootScene** — Loads 3 audio SFX + 4 custom bumper PNG sprites + flipper PNG sprite, then procedurally generates remaining visual assets (ball, 3 UI buttons) via Phaser Graphics + `generateTexture()`. Starts GameScene.
- **GameScene** — Main gameplay: table walls, bumpers, flippers, ball physics, scoring, lives, input, launch power bar.
- **GameOverScene** — Overlay (launched via `scene.launch()`, then GameScene is stopped). Shows final score, high score, "NEW HIGH SCORE!" pulse animation, restart button that calls `scene.start('GameScene')`.

**Game config** ([src/main.js](src/main.js)): Resolution 700×1050 (portrait), `Phaser.Scale.FIT` with `CENTER_BOTH`, `physics: false` (physics handled by Planck.js standalone world), 3 active pointers for multi-touch, `disableContextMenu: true` for mobile.

**Entry point:** `index.html` mounts Phaser into `#game-container` (wrapped in `#game-wrapper` flex column for responsive layout), imports `src/main.js` as module. CSS prevents scroll/zoom on mobile. Uses **Fredoka One** Google Font for HUD labels.

**HTML overlay for HUD:** Score, lives, and high score rendered as HTML elements in `#game-header`. Labels ("SCORE:", "HI SCORE:") have animated rainbow color cycle. Score values pop/shake on increase. Lives shown as ball icons (`'⚪'.repeat(lives)`). Responsive via `clamp()` font sizes. Updated via `document.getElementById()` from scenes — NOT drawn in Phaser.

### Physics (Planck.js)

Physics uses Planck.js (Box2D JavaScript port) via a standalone world, NOT Phaser's built-in Matter.js. Import: `import * as planck from 'planck';` ([GameScene.js:2](src/scenes/GameScene.js#L2)). Phaser config has `physics: false`.

**Scale conversion:** `SCALE = 100` (100 px = 1 m), with `toM(px)` / `toPx(m)` helpers. Box2D requires meter-scale (~0.1–10 m) for solver stability. All body positions/sizes are in meters; visual sprites synced from body positions each frame via `toPx()`.

**World:** `this._world = new planck.World({ gravity: { x: 0, y: 10 } })` (Y-down to match Phaser), stepped each frame in `update()`: `world.step(1/60, 10, 8)`.

- **Walls** — Static `planck.Box` bodies on a Planck world, restitution 0.3, friction 0.4. Includes left/right/top borders, bottom plates (gap for drain), launch lane divider, launch lane bottom stop, two funnel guides (angled ~54°), and corner deflector (45°). Wall visuals drawn as 8px stroke outlines via Graphics.
- **Bumpers** — Static `planck.Circle` bodies (r=0.36m), restitution 1.56. User data on fixtures stores `{points, type, sprite}` for collision callback lookup. Collision detected via `this._world.on('begin-contact')`. Visual sprites are custom 250×250 PNG images scaled to 0.288 (~72px), with pulsing glow overlay.
- **Flippers** — Dynamic polygon bodies (17-vertex tapered shape) connected to ground via `planck.RevoluteJoint` with motor + angle limits. Motor speed drives active/rest motion: `FLIPPER_MOTOR_ACTIVE = 5` rad/s (toward active), `FLIPPER_MOTOR_RETURN = 3` rad/s (return to rest), `maxMotorTorque = 50`. Sprite angles synced from `body.getAngle()` each frame. Sprite loaded from `flipper.png` (1224×417) scaled to `156/1224` (~156px wide, ~53px tall). Right flipper uses same texture with `setFlipX(true)`.
- **Ball** — Dynamic `planck.Circle` body (r=0.16m), `bullet: true` (continuous collision detection), restitution 0.3, friction 0, density 0.001. Visual sprite created separately via `this.add.image()` and synced from body position each frame.
- **Launch lane closure** — Static `planck.Box` body (0.75×0.16m, angle -15.5°) spawned when `x < 600 && y < 520 && vy < 0` (ball must be in play area, not still in lane) to seal the launch lane after ball exits upward. Has matching Graphics visual (4px line, color `0x3a3a6a`). Removed on ball respawn.
- **Velocity clamp** — After each `world.step()`, ball velocity clamped to `BALL.MAX_SPEED` (150 px/s, converted to meters) to prevent tunneling from bumper restitution spikes. Box2D uses standard velocity integration (no Verlet), so `setLinearVelocity()` is safe without positionPrev concerns.
- **Gravity control** — During launch charge: `world.setGravity({ x: 0, y: 0 })` (ball floats). On release: `world.setGravity({ x: 0, y: 10 })` (gravity restored).

### Game mechanics

- **Launch:** Hold Space (or touch launch button) to charge — gravity disabled (`_world.setGravity({x:0, y:0})`), power accumulates (`delta * chargeRate`, frame-rate independent), ball velocity zeroed on both Phaser sprite and Planck body. Release fires ball with `xVel: -10` and scaled y velocity, applied to both. Gravity restored (`_world.setGravity({x:0, y:10})`). Launch constants: `maxPower: 2600`, `chargeRate: 0.9`, `baseVel: 5`, `velScale: 0.0196875`.
- **Relaunch:** If ball falls back into launch lane (`x > 620 && y > 520 && vy > 0`), `ballLaunched` resets to false, allowing another charge-and-launch.
- **Velocity clamp:** Ball speed capped at 150 px/s post-`world.step()` in `update()` to prevent tunneling from bumper restitution spikes.
- **Lives:** 3 lives, `isLosingLife` guard prevents double-drain. Ball drain detected when `y > 1050`. Safety fallback: if launched ball stays below y=980 for >2s, force drain. On life lost: screen shake (200ms, 0.03 intensity), Planck body destroyed + Phaser sprite destroyed, ball respawned after 1s delay. Lives display initialized in `index.html` and updated via `document.getElementById()`.
- **Game over:** When lives reach 0, high score saved to localStorage (`earkandi_highscore`), GameOverScene launched as overlay, GameScene stopped.
- **Scoring:** Star=100, Heart=150, Moon=200, Flower=250. Score popups animate upward and fade on bumper hit. Score value triggers `.score-pop` CSS animation on increase.

### Asset pipeline

**Custom bumper sprites:** 4 PNG images (250×250, transparent BG) in `public/assets/images/`: `star.png`, `heart.png`, `moon.png`, `flower.png`. Loaded in BootScene `preload()`, referenced as `bumper-star`, `bumper-heart`, `bumper-moon`, `bumper-flower`. Used by bumpers, background decorative shapes, and GameOverScene.

**Flipper sprite:** `flipper.png` (1224×417 PNG, transparent BG, cropped from original 1536×1024) in `public/assets/images/`. Loaded in BootScene `preload()`, scaled to `156/1224` (~156px wide, ~53px tall) in GameScene. Right flipper uses same texture with `setFlipX(true)`.

**Procedural assets (BootScene `generateAssets()`):** Ball (32×32 white circle), 3 UI buttons (left/right arrow + launch up-arrow).

**Audio:** Generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`): `bumper-hit.wav`, `ball-drain.wav`, `flipper-activate.wav`.

### Controls

- Desktop: A/Left = left flipper, D/Right = right flipper, Space = hold-to-charge launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

### Visual features

Gradient background with 15 decorative shapes that float, rotate, and bounce off walls/each other (frame-based physics, not tweens), pulsing glow on bumpers, launch power bar (green→red gradient, only visible while charging), score popups on bumper hit, screen shake on life lost, rainbow-animated HUD labels, score pop effect on score increase.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
