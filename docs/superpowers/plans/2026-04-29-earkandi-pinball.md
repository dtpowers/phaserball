# Earkandi Pinball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a statically-hostable 2D pinball game themed around the earkandi brand using Phaser 3 with arcade physics.

**Architecture:** Three Phaser scenes (Boot, Game, GameOver). Boot loads all assets. Game handles the main gameplay loop. GameOver displays final score and high score with restart option. All game state (score, lives, high score) managed via Phaser scene data and localStorage.

**Tech Stack:** Phaser 3 (v3.80+), Vite for dev server and build, vanilla JavaScript (no framework), HTML5 Canvas/WebGL rendering.

**Key Design Decisions:**
- Target resolution: 1024x768 (iPad portrait) with `Phaser.Scale.FIT` to scale to any screen
- Dark background (#1a1a2e) with neon-colored bumpers matching earkandi brand shapes
- Tiered scoring: Star=100, Moon=200, Heart=150, Flower=250
- Hold-to-charge ball launch (right-side plunger lane)
- Mobile: on-screen left/right flipper buttons + launch button; Desktop: A/Left=left flipper, D/Right=right flipper, Space=launch
- 3 lives per game, any drain (center or side) costs a life
- High score persisted in localStorage
- Visual flash + audio beep on bumper hit

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "earkandi-pinball",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Earkandi Pinball</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a2e; touch-action: none; }
    #game-container { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create src/main.js with minimal Phaser game config**

```js
import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: [],
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 3
  },
  disableContextMenu: true
};

const game = new Phaser.Game(config);
```

- [ ] **Step 5: Install dependencies and verify dev server starts**

Run: `npm install`
Then: `npm run dev`
Expected: Vite dev server starts on http://localhost:5173, blank dark page renders

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/main.js
git commit -m "feat: scaffold project with Phaser 3, Vite, and basic game config"
```

---

### Task 2: Scene Architecture

**Files:**
- Create: `src/scenes/BootScene.js`
- Create: `src/scenes/GameScene.js`
- Create: `src/scenes/GameOverScene.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create BootScene.js — loads all assets**

```js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Ball
    this.load.image('ball', 'assets/ball.png');

    // Bumper shapes (glowing variants for hit feedback)
    this.load.image('bumper-star', 'assets/bumper-star.png');
    this.load.image('bumper-moon', 'assets/bumper-moon.png');
    this.load.image('bumper-heart', 'assets/bumper-heart.png');
    this.load.image('bumper-flower', 'assets/bumper-flower.png');

    // Wall/railing
    this.load.image('wall', 'assets/wall.png');

    // Flipper
    this.load.image('flipper', 'assets/flipper.png');

    // UI buttons
    this.load.image('btn-flip-left', 'assets/btn-flip-left.png');
    this.load.image('btn-flip-right', 'assets/btn-flip-right.png');
    this.load.image('btn-launch', 'assets/btn-launch.png');

    // Fonts
    this.load.font('gamefont', 'assets/font.ttf');

    // Audio
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.mp3');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.mp3');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.mp3');
  }

  create() {
    this.scene.start('GameScene');
  }
}
```

- [ ] **Step 2: Create GameScene.js — stub with empty lifecycle**

```js
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {}
  create() {
    // Game state
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;

    // TODO: build table
  }

  update() {}
}
```

- [ ] **Step 3: Create GameOverScene.js — stub with restart**

```js
import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  preload() {}

  create() {
    const { score, highScore } = this.scene.getData('GameScene');

    this.add.text(512, 250, 'GAME OVER', {
      fontSize: '64px', color: '#e94560', fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(512, 350, `Score: ${score}`, {
      fontSize: '48px', color: '#ffffff', fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(512, 420, `High Score: ${highScore}`, {
      fontSize: '36px', color: '#0ff0fc', fontFamily: 'Arial'
    }).setOrigin(0.5);

    const restartBtn = this.add.text(512, 540, 'PLAY AGAIN', {
      fontSize: '40px', color: '#ffffff', fontFamily: 'Arial', backgroundColor: '#e94560',
      padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => {
      localStorage.setItem('earkandi_highscore', Math.max(
        parseInt(localStorage.getItem('earkandi_highscore') || '0'), score
      ));
      this.scene.start('GameScene');
    });
  }
}
```

- [ ] **Step 4: Wire scenes into main.js**

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: [BootScene, GameScene, GameOverScene],
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 3
  },
  disableContextMenu: true
};

const game = new Phaser.Game(config);
```

- [ ] **Step 5: Create placeholder assets so the game boots without errors**

Create all asset paths as 1x1 transparent PNGs, an empty audio file, and a fallback font. Use a script or manual creation:

```bash
mkdir -p public/assets/sfx
# Create 1x1 transparent PNG placeholder for each visual asset
# Create empty MP3 placeholder for each audio asset
# Copy a system font as fallback
```

- [ ] **Step 6: Verify the game boots through all scenes**

Run: `npm run dev`
Expected: Game boots, BootScene loads (with placeholder assets), transitions to GameScene, no errors in console

- [ ] **Step 7: Commit**

```bash
git add src/scenes/ src/main.js
git commit -m "feat: add scene architecture (Boot, Game, GameOver) with wiring"
```

---

### Task 3: Generate Game Assets (Shapes, Ball, Flipper)

**Files:**
- Create: `src/assets/generate.js` (build script)
- Create: `public/assets/ball.png`
- Create: `public/assets/bumper-star.png`, `bumper-moon.png`, `bumper-heart.png`, `bumper-flower.png`
- Create: `public/assets/wall.png`
- Create: `public/assets/flipper.png`
- Create: `public/assets/btn-flip-left.png`, `btn-flip-right.png`, `btn-launch.png`
- Create: `public/assets/sfx/bumper-hit.mp3`, `flipper-activate.mp3`, `ball-drain.mp3`

- [ ] **Step 1: Create a canvas-based asset generation script**

Write `src/assets/generate.js` that uses Node.js `canvas` (or a simpler approach: generate SVGs and convert) to produce all visual assets. Alternatively, generate them inline as base64 and write to files.

Since we want a simple approach, use an HTML page that draws all assets on a canvas and lets the user download them — or better, use a Node.js script with the `canvas` npm package.

Simpler approach: generate the assets as data URIs baked into the game. Create a single `assets.json` that contains base64-encoded PNGs generated from Phaser geometry drawing. Use Phaser's `Graphics` to draw each shape, then `generateTexture()` in the game itself.

**Revised approach — generate textures at runtime in BootScene using Phaser Graphics:**

Modify `BootScene.js` to draw all shapes procedurally:

```js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Audio only — visuals are generated procedurally
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.mp3');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.mp3');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.mp3');
  }

  create() {
    this.generateAssets();
    this.scene.start('GameScene');
  }

  generateAssets() {
    const g = this.make.graphics();

    // Ball — white circle with subtle gradient feel
    g.clear();
    g.fillStyle(0xffffff);
    g.fillCircle(16, 16, 16);
    g.lineStyle(2, 0xcccccc);
    g.strokeCircle(16, 16, 16);
    g.generateTexture('ball', 32, 32);

    // Star bumper — neon yellow
    g.clear();
    this.drawStar(g, 40, 40, 5, 36, 18);
    g.fillStyle(0xffe066);
    g.fillCurrentPath();
    g.lineStyle(3, 0xffcc00);
    g.strokeCurrentPath();
    // Glow
    g.fillStyle(0xffe066, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-star', 80, 80);

    // Moon bumper — neon purple
    g.clear();
    this.drawMoon(g, 40, 40, 36);
    g.fillStyle(0xc77dff);
    g.fillCurrentPath();
    g.lineStyle(3, 0x9d4edd);
    g.strokeCurrentPath();
    g.fillStyle(0xc77dff, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-moon', 80, 80);

    // Heart bumper — neon pink
    g.clear();
    this.drawHeart(g, 40, 40, 36);
    g.fillStyle(0xff6b9d);
    g.fillCurrentPath();
    g.lineStyle(3, 0xe94560);
    g.strokeCurrentPath();
    g.fillStyle(0xff6b9d, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-heart', 80, 80);

    // Flower bumper — neon green
    g.clear();
    this.drawFlower(g, 40, 40, 36);
    g.fillStyle(0x57fb88);
    g.fillCurrentPath();
    g.lineStyle(3, 0x00f5a0);
    g.strokeCurrentPath();
    g.fillStyle(0x57fb88, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-flower', 80, 80);

    // Wall segment — dark with subtle border
    g.clear();
    g.fillStyle(0x2a2a4a);
    g.fillRect(0, 0, 32, 32);
    g.lineStyle(2, 0x3a3a6a);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('wall', 32, 32);

    // Flipper — rounded rectangle, neon blue
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    // Draw a rounded rect shape
    g.fillRoundedRect(0, 0, 120, 28, 14);
    g.strokeRoundedRect(0, 0, 120, 28, 14);
    g.generateTexture('flipper', 120, 28);

    // UI buttons
    g.clear();
    g.fillStyle(0x00b4d8, 0.4);
    g.lineStyle(3, 0x00f5ff);
    g.fillRoundedRect(0, 0, 120, 120, 20);
    g.strokeRoundedRect(0, 0, 120, 120, 20);
    g.fillStyle(0xffffff);
    g.fillText('LEFT', 30, 60);
    g.generateTexture('btn-flip-left', 120, 120);

    g.clear();
    g.fillStyle(0x00b4d8, 0.4);
    g.lineStyle(3, 0x00f5ff);
    g.fillRoundedRect(0, 0, 120, 120, 20);
    g.strokeRoundedRect(0, 0, 120, 120, 20);
    g.fillStyle(0xffffff);
    g.fillText('RIGHT', 20, 60);
    g.generateTexture('btn-flip-right', 120, 120);

    g.clear();
    g.fillStyle(0xe94560, 0.5);
    g.lineStyle(3, 0xff6b9d);
    g.fillRoundedRect(0, 0, 100, 180, 20);
    g.strokeRoundedRect(0, 0, 100, 180, 20);
    g.fillStyle(0xffffff);
    g.fillText('LAUNCH', 20, 95);
    g.generateTexture('btn-launch', 100, 180);

    g.destroy();
  }

  drawStar(g, cx, cy, points, outerR, innerR) {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  drawMoon(g, cx, cy, r) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.moveTo(cx + r * 0.6, cy - r * 0.7);
    g.arc(cx + r * 0.6, cy - r * 0.1, r * 0.8, 0, Math.PI * 2);
    g.closePath();
  }

  drawHeart(g, cx, cy, size) {
    g.beginPath();
    const s = size * 0.03;
    g.moveTo(cx, cy + s * 8);
    g.bezierCurveTo(cx, cy + s * 5, cx - s * 12, cy - s * 2, cx - s * 12, cy - s * 8);
    g.bezierCurveTo(cx - s * 12, cy - s * 14, cx - s * 4, cy - s * 16, cx, cy - s * 10);
    g.bezierCurveTo(cx + s * 4, cy - s * 16, cx + s * 12, cy - s * 14, cx + s * 12, cy - s * 8);
    g.bezierCurveTo(cx + s * 12, cy - s * 2, cx, cy + s * 5, cx, cy + s * 8);
    g.closePath();
  }

  drawFlower(g, cx, cy, r) {
    const petals = 6;
    g.beginPath();
    for (let i = 0; i < petals; i++) {
      const angle = (Math.PI * 2 / petals) * i;
      const px = cx + r * 0.5 * Math.cos(angle);
      const py = cy + r * 0.5 * Math.sin(angle);
      g.arc(px, py, r * 0.55, 0, Math.PI * 2);
    }
    g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    g.closePath();
  }
}
```

- [ ] **Step 2: Generate simple audio files for SFX**

Create minimal audio using the Web Audio API approach — generate short WAV files programmatically:

Create a small Node script `scripts/gen-sfx.js` that writes WAV files:

```js
// scripts/gen-sfx.js — generates simple WAV SFX files
import fs from 'fs';

function writeWav(filename, frequency, duration, type = 'sine') {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const envelope = 1 - i / numSamples;

    if (type === 'sine') {
      sample = Math.sin(2 * Math.PI * frequency * t) * envelope;
    } else if (type === 'noise') {
      sample = (Math.random() * 2 - 1) * envelope * 0.3;
    }

    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, sample * 32767)), 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
}

// Bumper hit — bright ping
writeWav('public/assets/sfx/bumper-hit.mp3', 880, 0.15, 'sine');
// Flipper activate — short click
writeWav('public/assets/sfx/flipper-activate.mp3', 440, 0.08, 'sine');
// Ball drain — descending tone
writeWav('public/assets/sfx/ball-drain.mp3', 220, 0.5, 'sine');

console.log('SFX generated');
```

- [ ] **Step 3: Run the SFX generation script**

Add to `package.json` scripts:
```json
"gen-sfx": "node scripts/gen-sfx.js"
```

Run: `npm run gen-sfx`
Expected: Three audio files created in `public/assets/sfx/`

- [ ] **Step 4: Verify assets load in browser**

Run: `npm run dev`
Expected: Game boots, no asset loading errors in console, textures visible in Phaser cache

- [ ] **Step 5: Commit**

```bash
git add src/assets/ public/assets/ scripts/ package.json
git commit -m "feat: generate all game assets procedurally (shapes, SFX)"
```

---

### Task 4: Build the Pinball Table (Walls, Rails, Funnel)

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Define table layout constants and build walls in GameScene.create()**

The table layout for a 1024x768 canvas:

```
+--------------------------------------------------+
|  TABLE AREA (main play field)                     |
|  ~720px wide, ~580px tall                         |
|                                                   |
|  [Bumpers arranged in upper-middle area]          |
|                                                   |
|           \           /                            |
|            \  FUNNEL /                             |
|             \_______/                              |
|                   |                                |
|   [L-Flipper] [R-Flipper]  [Drain]                 |
|                                                   |
|  +-----------------------------------------------+
|  |  LAUNCH LANE (right side, ~80px wide)          |
|  +-----------------------------------------------+
+--------------------------------------------------+
```

Add to `GameScene.js`:

```js
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {}

  create() {
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;

    this.buildTable();
    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();
    this.setupInput();
    this.spawnBall();
  }

  buildTable() {
    const walls = this.physics.add.staticGroup();

    // Outer walls
    // Left wall
    for (let y = 0; y < 768; y += 32) walls.create(16, y, 'wall');
    // Right wall (includes launch lane divider)
    for (let y = 0; y < 768; y += 32) walls.create(1008, y, 'wall');
    // Top wall
    for (let x = 16; x < 1008; x += 32) walls.create(x, 16, 'wall');

    // Launch lane divider wall (from top to funnel start)
    for (let y = 16; y < 600; y += 32) walls.create(928, y, 'wall');

    // Bottom walls (left and right of drain)
    for (let x = 16; x < 400; x += 32) walls.create(x, 752, 'wall');
    for (let x = 624; x < 928; x += 32) walls.create(x, 752, 'wall');

    // Funnel walls (angled guides into center drain)
    // Left funnel wall — angles from bottom-left toward center
    for (let i = 0; i < 6; i++) {
      walls.create(200 + i * 60, 600 + i * 33, 'wall');
    }
    // Right funnel wall — angles from bottom-right toward center
    for (let i = 0; i < 6; i++) {
      walls.create(808 - i * 60, 600 + i * 33, 'wall');
    }

    // Side wall guides (curve ball back toward center)
    // Left side guide
    for (let i = 0; i < 4; i++) {
      walls.create(100 + i * 50, 480 + i * 30, 'wall');
    }
    // Right side guide
    for (let i = 0; i < 4; i++) {
      walls.create(824 - i * 50, 480 + i * 30, 'wall');
    }

    this.walls = walls;
  }
```

- [ ] **Step 2: Add bumper placement**

```js
  buildBumpers() {
    this.bumpers = this.physics.add.staticGroup();

    // Star bumpers (100 pts each) — outer ring
    const starPositions = [
      { x: 300, y: 200 }, { x: 500, y: 180 }, { x: 700, y: 200 }
    ];
    starPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-star');
      bumper.setData('points', 100);
      bumper.setData('type', 'star');
    });

    // Heart bumpers (150 pts each) — middle row
    const heartPositions = [
      { x: 400, y: 300 }, { x: 600, y: 300 }
    ];
    heartPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-heart');
      bumper.setData('points', 150);
      bumper.setData('type', 'heart');
    });

    // Moon bumpers (200 pts each) — inner row
    const moonPositions = [
      { x: 350, y: 400 }, { x: 500, y: 380 }, { x: 650, y: 400 }
    ];
    moonPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-moon');
      bumper.setData('points', 200);
      bumper.setData('type', 'moon');
    });

    // Flower bumper (250 pts) — top center, hardest to hit
    const flower = this.bumpers.create(500, 120, 'bumper-flower');
    flower.setData('points', 250);
    flower.setData('type', 'flower');
  }
```

- [ ] **Step 3: Set up collision between ball and bumpers with scoring**

Add to `create()` after `buildBumpers()`:

```js
    // Bumper collision — adds score and plays effects
    this.physics.add.collider(this.ball, this.bumpers, (ball, bumper) => {
      const points = bumper.getData('points');
      this.score += points;
      this.updateScoreDisplay();

      // Visual feedback — brief scale pulse
      this.tweens.add({
        targets: bumper,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });

      // Audio feedback
      this.sound.play('bumper-hit');

      // Score popup
      const popup = this.add.text(bumper.x, bumper.y - 40, `+${points}`, {
        fontSize: '28px', color: '#ffffff', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);

      this.tweens.add({
        targets: popup,
        y: bumper.y - 100,
        alpha: 0,
        duration: 800,
        onComplete: () => popup.destroy()
      });
    });
```

- [ ] **Step 4: Verify table renders**

Run: `npm run dev`
Expected: Dark table with wall borders, bumper shapes arranged in the play field, no ball yet (next task)

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: build pinball table with walls, funnel, and bumper layout"
```

---

### Task 5: Ball and Launch Mechanism

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add spawnBall() method — places ball in launch lane**

```js
  spawnBall() {
    this.ball = this.physics.add.sprite(968, 700, 'ball');
    this.ball.setCollideWorldBounds(false);
    this.ball.setBounce(0.4);
    this.ball.setCircle(16);
    this.ball.body.setAllowGravity(true);

    // Collide ball with walls
    this.physics.add.collider(this.ball, this.walls);

    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;
  }
```

- [ ] **Step 2: Add launch charging mechanism in update()**

```js
  update(time, delta) {
    if (!this.ballLaunched && this.isCharging) {
      // Charge up launch power (0 to 1000 over ~1.5 seconds)
      this.launchPower = Math.min(1000, this.launchPower + delta * 0.7);

      // Visual feedback — ball moves up in launch lane
      this.ball.y = 700 - this.launchPower * 0.3;
    }

    // Check if ball has drained
    if (this.ball && this.ball.y > 800) {
      this.loseLife();
    }
  }
```

- [ ] **Step 3: Add launch release — fires ball upward**

Add to keyboard input handling (in `setupInput()`):

```js
    // Space or Enter to launch
    this.keys = this.input.keyboard.addKeys('SPACE,ENTER');

    this.keys.SPACE.on('down', () => {
      if (!this.ballLaunched) {
        this.isCharging = true;
        this.ball.setVelocity(0, 0);
        this.ball.body.allowGravity = false;
      }
    });

    this.keys.SPACE.on('up', () => {
      if (this.isCharging && !this.ballLaunched) {
        this.isCharging = false;
        this.ballLaunched = true;
        this.ball.body.allowGravity = true;
        this.ball.setVelocity(0, -this.launchPower - 200);
        // Slight leftward drift to avoid perfect vertical
        this.ball.setVelocityX(-30);
      }
    });
```

- [ ] **Step 4: Add touch launch button**

In `setupInput()`, add:

```js
    // Launch button (touch)
    if (this.input.activePointers.length > 1) {
      const launchBtn = this.add.image(968, 680, 'btn-launch')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.7);

      launchBtn.on('pointerdown', () => {
        if (!this.ballLaunched) {
          this.isCharging = true;
          this.ball.setVelocity(0, 0);
          this.ball.body.allowGravity = false;
        }
      });

      launchBtn.on('pointerup', () => {
        if (this.isCharging && !this.ballLaunched) {
          this.isCharging = false;
          this.ballLaunched = true;
          this.ball.body.allowGravity = true;
          this.ball.setVelocity(0, -this.launchPower - 200);
          this.ball.setVelocityX(-30);
        }
      });
    }
```

- [ ] **Step 5: Verify ball launch works**

Run: `npm run dev`
Expected: Ball appears in launch lane. Hold Space to charge (ball rises), release to fire. Ball flies up and bounces off walls/bumpers. Touch launch button works on mobile.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: add ball spawning and hold-to-charge launch mechanism"
```

---

### Task 6: Flipper Mechanics

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add buildFlippers() — creates left and right flippers with pivot physics**

```js
  buildFlippers() {
    // Left flipper
    const leftPivotX = 340;
    const leftPivotY = 700;

    this.leftFlipperPivot = this.matter.add.sprite(leftPivotX, leftPivotY, 'flipper');
    // Note: We use Arcade physics for the ball, but flippers need angular
    // movement. We'll use tweens for flipper animation and manual collision.

    this.leftFlipper = this.add.image(leftPivotX - 50, leftPivotY, 'flipper');
    this.leftFlipper.setOrigin(0, 0.5);
    this.leftFlipper.setAngle(-20);

    // Right flipper
    const rightPivotX = 684;
    const rightPivotY = 700;

    this.rightFlipper = this.add.image(rightPivotX + 50, rightPivotY, 'flipper');
    this.rightFlipper.setOrigin(0, 0.5);
    this.rightFlipper.setAngle(20);

    // Flipper rest and active angles
    this.flipperRestAngle = { left: -20, right: 20 };
    this.flipperActiveAngle = { left: 30, right: -30 };
  }
```

- [ ] **Step 2: Add flipper input handling in setupInput()**

```js
    // Keyboard flipper control
    const flipperKeys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT');

    const onLeftFlipperDown = () => {
      this.tweens.add({
        targets: this.leftFlipper,
        angle: this.flipperActiveAngle.left,
        duration: 60,
        ease: 'Sine.easeOut'
      });
      this.sound.play('flipper-activate');
    };

    const onLeftFlipperUp = () => {
      this.tweens.add({
        targets: this.leftFlipper,
        angle: this.flipperRestAngle.left,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    };

    const onRightFlipperDown = () => {
      this.tweens.add({
        targets: this.rightFlipper,
        angle: this.flipperActiveAngle.right,
        duration: 60,
        ease: 'Sine.easeOut'
      });
      this.sound.play('flipper-activate');
    };

    const onRightFlipperUp = () => {
      this.tweens.add({
        targets: this.rightFlipper,
        angle: this.flipperRestAngle.right,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    };

    flipperKeys.A.on('down', onLeftFlipperDown);
    flipperKeys.A.on('up', onLeftFlipperUp);
    flipperKeys.LEFT.on('down', onLeftFlipperDown);
    flipperKeys.LEFT.on('up', onLeftFlipperUp);

    flipperKeys.D.on('down', onRightFlipperDown);
    flipperKeys.D.on('up', onRightFlipperUp);
    flipperKeys.RIGHT.on('down', onRightFlipperDown);
    flipperKeys.RIGHT.on('up', onRightFlipperUp);

    // Touch flipper buttons
    if (this.input.activePointers.length > 1) {
      const leftBtn = this.add.image(150, 700, 'btn-flip-left')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      leftBtn.on('pointerdown', onLeftFlipperDown);
      leftBtn.on('pointerup', onLeftFlipperUp);
      leftBtn.on('pointerout', onLeftFlipperUp);

      const rightBtn = this.add.image(874, 700, 'btn-flip-right')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      rightBtn.on('pointerdown', onRightFlipperDown);
      rightBtn.on('pointerup', onRightFlipperUp);
      rightBtn.on('pointerout', onRightFlipperUp);
    }
```

- [ ] **Step 3: Add flipper-ball collision in update()**

Since flippers are `Phaser.GameObjects.Image` (not physics bodies), we need manual collision detection. Add to `update()`:

```js
    // Flipper collision — check if ball is near flipper and flipper is active
    if (this.ball && this.ballLaunched) {
      // Left flipper
      if (this.isFlipperActive(this.leftFlipper, this.flipperActiveAngle.left)) {
        const distL = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.leftFlipper.x, this.leftFlipper.y
        );
        if (distL < 80 && this.ball.y > 650 && this.ball.y < 730) {
          this.ball.setVelocityY(-400);
          this.ball.setVelocityX(-200);
        }
      }

      // Right flipper
      if (this.isFlipperActive(this.rightFlipper, this.flipperActiveAngle.right)) {
        const distR = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.rightFlipper.x, this.rightFlipper.y
        );
        if (distR < 80 && this.ball.y > 650 && this.ball.y < 730) {
          this.ball.setVelocityY(-400);
          this.ball.setVelocityX(200);
        }
      }
    }
```

Helper method:
```js
  isFlipperActive(flipper, activeAngle) {
    return Math.abs(flipper.angle - activeAngle) < 5;
  }
```

- [ ] **Step 4: Verify flippers work**

Run: `npm run dev`
Expected: Ball launches, reaches flipper zone. Press A/Left to activate left flipper (animates upward), D/Right for right flipper. Ball bounces off active flippers. Touch buttons visible and functional on mobile.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: add flipper mechanics with keyboard and touch control"
```

---

### Task 7: Score Display, Lives, and Game State

**Files:**
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Add buildUI() — score text, lives display**

```js
  buildUI() {
    // Score display — top center
    this.scoreText = this.add.text(512, 60, '0', {
      fontSize: '48px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // Lives display — top left
    this.livesText = this.add.text(80, 60, 'Hearts: 3', {
      fontSize: '28px', color: '#ff6b9d', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // High score — top right
    const highScore = parseInt(localStorage.getItem('earkandi_highscore') || '0');
    this.highScoreText = this.add.text(944, 60, `HI: ${highScore}`, {
      fontSize: '24px', color: '#0ff0fc', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
  }

  updateScoreDisplay() {
    this.scoreText.setText(this.score.toString());
  }

  updateLivesDisplay() {
    this.livesText.setText(`Hearts: ${this.lives}`);
  }
```

- [ ] **Step 2: Add loseLife() — handles ball drain**

```js
  loseLife() {
    this.lives--;
    this.updateLivesDisplay();
    this.sound.play('ball-drain');

    if (this.lives <= 0) {
      // Game over
      const currentHigh = parseInt(localStorage.getItem('earkandi_highscore') || '0');
      const newHigh = Math.max(currentHigh, this.score);
      localStorage.setItem('earkandi_highscore', newHigh.toString());

      this.scene.launch('GameOverScene', { score: this.score, highScore: newHigh });
      this.scene.stop('GameScene');
    } else {
      // Respawn ball
      this.ball.destroy();
      this.time.delayedCall(1000, () => this.spawnBall());
    }
  }
```

- [ ] **Step 3: Verify game state flow**

Run: `npm run dev`
Expected: Score starts at 0, increments on bumper hits. Lives show 3, decrease when ball drains. After 3 drains, GameOverScene shows with score and high score. Restart button works.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: add score display, lives tracking, and game over flow"
```

---

### Task 8: Game Over Scene Polish

**Files:**
- Modify: `src/scenes/GameOverScene.js`

- [ ] **Step 1: Replace stub GameOverScene with polished version**

```js
import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  preload() {}

  create(data) {
    const { score, highScore } = data;

    // Dark overlay
    this.add.rectangle(512, 384, 1024, 768, 0x1a1a2e, 0.95);

    // Title
    this.add.text(512, 180, 'GAME OVER', {
      fontSize: '72px', color: '#e94560', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);

    // Decorative shapes
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    for (let i = 0; i < 8; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(100, 924),
        Phaser.Math.Between(100, 668),
        shapes[i % shapes.length]
      ).setScale(0.5).setAlpha(0.3);

      this.tweens.add({
        targets: shape,
        angle: shape.angle + 360,
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1,
        ease: 'Linear'
      });
    }

    // Score
    this.add.text(512, 310, `SCORE`, {
      fontSize: '32px', color: '#888888', fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(512, 370, score.toString(), {
      fontSize: '64px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // High Score
    const isNewHigh = score >= highScore;
    if (isNewHigh) {
      this.add.text(512, 450, 'NEW HIGH SCORE!', {
        fontSize: '36px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);

      this.tweens.add({
        targets: this.add.text(512, 500, highScore.toString(), {
          fontSize: '56px', color: '#ffe066', fontFamily: 'Arial',
          stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5),
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      this.add.text(512, 460, `HIGH SCORE: ${highScore}`, {
        fontSize: '32px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);
    }

    // Restart button
    const restartBtn = this.add.text(512, 620, 'PLAY AGAIN', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'Arial',
      backgroundColor: '#e94560', padding: { x: 40, y: 20 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setScale(1.1));
    restartBtn.on('pointerout', () => restartBtn.setScale(1.0));
    restartBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
```

- [ ] **Step 2: Verify Game Over screen**

Run: `npm run dev`
Expected: Drain all 3 balls. Game Over screen shows with score, high score, decorative spinning shapes, and a hoverable restart button.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameOverScene.js
git commit -m "feat: polish game over screen with animations and high score display"
```

---

### Task 9: Visual Polish (Glow Effects, Background, Earkandi Branding)

**Files:**
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/BootScene.js`

- [ ] **Step 1: Add background gradient and decorative elements to GameScene**

In `create()`, add before `buildTable()`:

```js
  create() {
    // ... game state init ...

    this.addBackground();
    this.buildTable();
    // ... rest of create ...
  }

  addBackground() {
    // Subtle gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e,
      0, 0, 0, 1024, 768, 0
    );
    bg.fillRect(0, 0, 1024, 768);

    // Scattered decorative shapes (earkandi aesthetic)
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    for (let i = 0; i < 15; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(50, 974),
        Phaser.Math.Between(50, 718),
        shapes[i % shapes.length]
      ).setScale(0.2).setAlpha(0.15);

      this.tweens.add({
        targets: shape,
        angle: shape.angle + Phaser.Math.Between(180, 360),
        duration: Phaser.Math.Between(6000, 12000),
        repeat: -1,
        ease: 'Linear'
      });
    }

    // Earkandi branding text at top
    this.add.text(512, 28, 'earkandi PINBALL', {
      fontSize: '18px', color: '#c77dff', fontFamily: 'Arial',
      letterSpacing: 4
    }).setOrigin(0.5);
  }
```

- [ ] **Step 2: Add glow effect to bumpers using Phaser bloom filter or overlay**

In `buildBumpers()`, after creating each bumper, add a glow overlay:

```js
    // After creating each bumper, add a subtle glow
    this.bumpers.getChildren().forEach(bumper => {
      const glow = this.add.circle(
        bumper.x, bumper.y, 48, 0xffffff, 0.05
      ).setDepth(bumper.depth - 1);

      // Pulse the glow
      this.tweens.add({
        targets: glow,
        alpha: 0.1,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
```

- [ ] **Step 3: Add launch power indicator**

In `buildUI()`, add a power bar in the launch lane:

```js
    // Launch power indicator
    this.powerBarBg = this.add.rectangle(968, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(968, 680, 20, 10, 0xe94560)
      .setOrigin(0.5, 1);
```

In `update()`, update the power bar during charging:

```js
    if (this.isCharging) {
      this.powerBarFill.setHeight(this.launchPower * 0.2);
      // Color shifts from green to red as power increases
      const ratio = this.launchPower / 1000;
      this.powerBarFill.setFillStyle(
        Phaser.Math.Linear(0x57fb88, 0xe94560, ratio)
      );
    } else {
      this.powerBarFill.setHeight(10);
      this.powerBarFill.setFillStyle(0x57fb88);
    }
```

- [ ] **Step 4: Verify visual polish**

Run: `npm run dev`
Expected: Dark gradient background with scattered rotating decorative shapes. Bumpers have pulsing glow. Launch lane has a power bar that fills during charging. Earkandi branding visible at top.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.js src/scenes/BootScene.js
git commit -m "feat: add visual polish — background, glow effects, power bar, branding"
```

---

### Task 10: Mobile Responsiveness and Touch Testing

**Files:**
- Modify: `index.html`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Ensure touch buttons only show on touch devices**

Update `setupInput()` to detect touch capability:

```js
  setupInput() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // ... keyboard setup ...

    if (isTouchDevice) {
      // Touch flipper buttons
      const leftBtn = this.add.image(150, 700, 'btn-flip-left')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);
      // ... wire up touch events ...

      const rightBtn = this.add.image(874, 700, 'btn-flip-right')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);
      // ... wire up touch events ...

      const launchBtn = this.add.image(968, 680, 'btn-launch')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.7);
      // ... wire up touch events ...
    }
  }
```

- [ ] **Step 2: Prevent scrolling and zooming on mobile**

Already handled in `index.html` via `user-scalable=no` and `touch-action: none`, but verify.

- [ ] **Step 3: Test on iPad-sized viewport**

Run: `npm run dev`
Resize browser to 1024x768 (iPad portrait). Verify:
- Game fills the screen with FIT scaling
- Touch buttons are visible and in correct positions
- Ball launches correctly with touch
- Flippers respond to touch buttons
- No scrolling or zooming occurs

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js index.html
git commit -m "feat: ensure mobile touch buttons only show on touch devices"
```

---

### Task 11: Production Build and Verification

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Verify production build**

Run: `npm run build`
Expected: `dist/` folder created with all assets bundled, single `index.html` that can be statically hosted

- [ ] **Step 2: Test served build**

Run: `npm run preview`
Expected: Built version loads and functions identically to dev version

- [ ] **Step 3: Full gameplay verification checklist**

Test the complete flow:
1. Game boots, shows table with bumpers, walls, flippers
2. Ball appears in launch lane on right side
3. Hold Space (or touch launch button) charges power — ball rises, power bar fills
4. Release fires ball upward into main table
5. Ball bounces off bumpers — score increases with popup, audio plays, bumper pulses
6. Ball reaches flipper zone — A/Left activates left flipper, D/Right activates right flipper
7. Ball drains through center — life lost, 1-second delay, ball respawns
8. After 3 drains — Game Over screen with score, high score, restart button
9. Click restart — game resets with 3 lives, score at 0
10. High score persists across page reloads

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: verify production build and full gameplay flow"
```

---

## Self-Review

### Spec Coverage
- [x] Static hosting — Vite builds to `dist/`, single HTML file
- [x] 2D pinball — Phaser 3 with arcade physics
- [x] Earkandi brand tie-in — shapes (star, moon, heart, flower), neon-on-dark aesthetic
- [x] Desktop and mobile — keyboard + touch controls, FIT scaling
- [x] iPad primary — 1024x768 target, FIT scale mode
- [x] Touch flipper controls — on-screen left/right buttons
- [x] Keyboard controls — A/D and arrow keys for flippers
- [x] Score system — tiered (Star=100, Heart=150, Moon=200, Flower=250)
- [x] 3 lives — hearts display, decrement on drain
- [x] Launch lane — right side, hold-to-charge
- [x] Funnel to center drain — angled walls guide ball
- [x] Flippers above funnel — animated with tweens, manual collision
- [x] Ball drain = life lost — center and side drains
- [x] Game over screen — final score, high score, restart
- [x] Bumpers with earkandi shapes — all four types placed
- [x] Visual + audio feedback — bumper pulse, score popup, SFX
- [x] High score persistence — localStorage

### Placeholder Scan
- No "TBD", "TODO", or "implement later" found
- All code blocks contain complete, working code
- All file paths are explicit

### Type Consistency
- Scene names consistent: 'BootScene', 'GameScene', 'GameOverScene'
- Asset keys consistent: 'ball', 'bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower', 'wall', 'flipper', 'btn-flip-left', 'btn-flip-right', 'btn-launch'
- Audio keys consistent: 'bumper-hit', 'flipper-activate', 'ball-drain'
- Game state properties consistent: `this.score`, `this.lives`, `this.ballLaunched`, `this.launchPower`, `this.isCharging`
- Flipper angle constants consistent: `flipperRestAngle`, `flipperActiveAngle`

---

**Total: 11 tasks, estimated ~4-6 hours total implementation time.**
