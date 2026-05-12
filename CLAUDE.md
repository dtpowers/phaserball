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

**Vite config** ([vite.config.js](vite.config.js)): `root: '.'`, `publicDir: 'public'`, build outputs to `dist/assets`. ES module project (`"type": "module"` in package.json). Single dependency: `phaser@^3.80.1`.

**Three Phaser scenes:**
- **BootScene** — Loads 3 audio SFX + 4 custom bumper PNG sprites + flipper PNG sprite, then procedurally generates remaining visual assets (ball, 3 UI buttons) via Phaser Graphics + `generateTexture()`. Starts GameScene.
- **GameScene** — Main gameplay: table walls, bumpers, flippers, ball physics, scoring, lives, input, launch power bar.
- **GameOverScene** — Overlay (launched via `scene.launch()`, then GameScene is stopped). Shows final score, high score, "NEW HIGH SCORE!" pulse animation, restart button that calls `scene.start('GameScene')`.

**Game config** ([src/main.js](src/main.js)): Resolution 700×1050 (portrait), `Phaser.Scale.FIT` with `CENTER_BOTH`, **Matter physics** (gravity y=1, `enableSleeping: false`, `setBounds: false`), 3 active pointers for multi-touch, `disableContextMenu: true` for mobile.

**Entry point:** `index.html` mounts Phaser into `#game-container` (wrapped in `#game-wrapper` flex column for responsive layout), imports `src/main.js` as module. CSS prevents scroll/zoom on mobile. Uses **Fredoka One** Google Font for HUD labels.

**HTML overlay for HUD:** Score, lives, and high score rendered as HTML elements in `#game-header`. Labels ("SCORE:", "HI SCORE:") have animated rainbow color cycle. Score values pop/shake on increase. Lives shown as ball icons (`'⚪'.repeat(lives)`). Responsive via `clamp()` font sizes. Updated via `document.getElementById()` from scenes — NOT drawn in Phaser.

### Physics (Matter.js)

All physics uses Matter through Phaser's `this.matter` API. Import: `const Matter = Phaser.Physics.Matter.Matter;` (see [GameScene.js:3](src/scenes/GameScene.js#L3)).

- **Walls** — Static rectangles via `this.matter.add.rectangle()` with `isStatic: true, restitution: 0.3` (slight bounce). Includes left/right/top borders, bottom left/right plates (gap in center for drain), launch lane divider, launch lane bottom stop, and two funnel guides (16px thick). Wall visuals drawn as 8px stroke outlines via Graphics, side walls shortened to 1008px height for flush corner alignment.
- **Bumpers** — Static circles (`isStatic: true`, `restitution: 1.8`) with `bumperData` attached for collision callback lookup. Collision detected via `matter.world.on('collisionstart')`. Visual sprites are custom 250×250 PNG images scaled to 0.288 (~72px), with pulsing glow overlay.
- **Flippers** — Tween-driven sprite angle (42ms active, 84ms rest, `Sine.easeOut`) with **Matter physics bodies synced each frame**. `leftFlipperBody`/`rightFlipperBody` are **tapered trapezoids** created via `this.matter.add.fromVertices()` (28px wide at pivot, 8px at tip), `restitution: 0.3`, `friction: 0.4`. Pinned by `worldConstraint` at pivot points `(121.6,820)` and `(514.4,820)`. Linear velocity zeroed before `Matter.Body.setPosition()`/`Matter.Body.setAngle()` in `update()` to prevent explosive ball reactions; angular velocity preserved for natural momentum transfer. Sprite loaded from `flipper.png` (1536×1024) scaled to `156/1536` to match original 156px width. Right flipper uses same texture with `setFlipX(true)`.
- **Ball** — Created directly via `this.matter.add.image()` in `spawnBall()`. No group pattern. Restitution 0.8, zero friction, `frictionAir: 0.0001`, `density: 0.001`, `slop: 0.01`, circle shape radius 16.
- **Launch lane closure** — Dynamic wall (`isStatic: true`) spawned when `x < 600 && y < 520 && vy < 0` (ball must be in play area, not still in lane) to seal the launch lane after ball exits upward. Has matching Graphics visual (4px line, color `0x3a3a6a`). Removed on ball respawn.
- **Safety net** — `this.matter.world.setBounds(0, 0, 700, 1050, true, false, true, true)` (right, bottom=off, left, top enabled) as fallback to prevent ball escape from tunneling.

### Game mechanics

- **Launch:** Hold Space (or touch launch button) to charge — gravity is disabled (`setGravity(0, 0)`), power accumulates (`delta * chargeRate`, frame-rate independent), ball velocity zeroed. Release fires ball with `xVel: -10` and scaled y velocity. Gravity restored to `(0, 1)`. Launch constants: `maxPower: 2000`, `chargeRate: 0.9`, `baseVel: 5`, `velScale: 0.013125`.
- **Relaunch:** If ball falls back into launch lane (`x > 620 && y > 520 && vy > 0`), `ballLaunched` resets to false, allowing another charge-and-launch.
- **Velocity clamp:** Ball speed capped at 200 px/s in `update()` to prevent tunneling.
- **Lives:** 3 lives, `isLosingLife` guard prevents double-drain. Ball drain detected when `y > 1050`. On life lost: screen shake (200ms, 0.03 intensity), ball destroyed and respawned after 1s delay. Lives display reset in `create()`.
- **Game over:** When lives reach 0, high score saved to localStorage (`earkandi_highscore`), GameOverScene launched as overlay, GameScene stopped.
- **Scoring:** Star=100, Heart=150, Moon=200, Flower=250. Score popups animate upward and fade on bumper hit. Score value triggers `.score-pop` CSS animation on increase.

### Asset pipeline

**Custom bumper sprites:** 4 PNG images (250×250, transparent BG) in `public/assets/images/`: `star.png`, `heart.png`, `moon.png`, `flower.png`. Loaded in BootScene `preload()`, referenced as `bumper-star`, `bumper-heart`, `bumper-moon`, `bumper-flower`. Used by bumpers, background decorative shapes, and GameOverScene.

**Flipper sprite:** `flipper.png` (1536×1024 PNG, transparent BG) in `public/assets/images/`. Loaded in BootScene `preload()`, scaled to `156/1536` (~156px wide) in GameScene. Right flipper uses same texture with `setFlipX(true)`.

**Procedural assets (BootScene `generateAssets()`):** Ball (32×32 white circle), 3 UI buttons (left/right arrow + launch up-arrow).

**Audio:** Generated via `scripts/gen-sfx.js` (WAV files in `public/assets/sfx/`): `bumper-hit.wav`, `ball-drain.wav`, `flipper-activate.wav`.

### Controls

- Desktop: A/Left = left flipper, D/Right = right flipper, Space = hold-to-charge launch
- Mobile: on-screen left/right flipper buttons + launch button (only shown on touch devices)

### Visual features

Gradient background with 15 decorative shapes that float, rotate, and bounce off walls/each other (frame-based physics, not tweens), pulsing glow on bumpers, launch power bar (green→red gradient, only visible while charging), score popups on bumper hit, screen shake on life lost, rainbow-animated HUD labels, score pop effect on score increase.

## Phaser Skill

A Phaser-specific development skill is installed at `.claude/phaser-game-development-1/SKILL.md`. Key principles: scene-first architecture, composition over inheritance, physics-aware design, asset pipeline discipline, frame-rate independence. See the skill for anti-patterns to avoid.
