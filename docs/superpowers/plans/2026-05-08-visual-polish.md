# Visual Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add screen shake on life loss, replace bumper sprites with custom kandi art, taper flipper shapes, and add animated rainbow HUD labels with score pop effects.

**Architecture:** Four independent features, each touching specific files. Features 1+2 share no files with 3+4, so they can be executed in parallel pairs. All verification is visual — run `npm run dev` and inspect in browser.

**Tech Stack:** Phaser 3 (Matter.js physics), Vite, HTML/CSS animations, Google Fonts (Fredoka One), Matter.js `fromVertices` for custom physics bodies.

---

## File Change Map

| File | Feature 1 | Feature 2 | Feature 3 | Feature 4 |
|------|-----------|-----------|-----------|-----------|
| `index.html` | — | — | — | HTML + CSS |
| `src/scenes/BootScene.js` | — | preload() + generateAssets() | generateAssets() | — |
| `src/scenes/GameScene.js` | loseLife() | buildBumpers() | buildFlippers() | updateScoreDisplay(), create(), loseLife() |
| `public/assets/images/` | — | already present | — | — |

**Execution order for parallel subagents:**
- Task 1 (screen shake) and Task 2 (bumper sprites) can run in parallel
- Task 3 (flippers) and Task 4 (HUD) can run in parallel
- Tasks 2 and 3 both touch BootScene.js — coordinate or serialize
- Tasks 1 and 4 both touch GameScene.js — coordinate or serialize

---

### Task 1: Screen Shake on Life Lost

**Files:**
- Modify: `src/scenes/GameScene.js:524-547` (loseLife method)

**Context:** The `loseLife()` method is called when the ball drains off the table. We add a single line after the sound plays.

- [ ] **Step 1: Add camera shake to loseLife()**

  In `src/scenes/GameScene.js`, in the `loseLife()` method, add one line after `this.sound.play('ball-drain')`:

```js
  loseLife() {
    if (this.isLosingLife) return;
    this.isLosingLife = true;
    this.lives--;
    this.updateLivesDisplay();
    this.sound.play('ball-drain');
    this.cameras.main.shake(200, 0.03);
```

  That's the only change for this task.

- [ ] **Step 2: Verify in browser**

  Run: `npm run dev`
  Open browser to localhost:5173. Play the game and let the ball drain. Verify:
  - Screen shakes briefly when ball drains
  - Shake does NOT occur on bumper hits or flipper actuation
  - No visual artifacts after shake completes

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: add screen shake on life lost (200ms, 0.03 intensity)"
```

---

### Task 2: Custom Bumper Sprites

**Files:**
- Modify: `src/scenes/BootScene.js` — preload() (add 4 image loads), generateAssets() (remove procedural bumper code + helper methods)
- Modify: `src/scenes/GameScene.js` — buildBumpers() (add setScale call)
- Assets: `public/assets/images/{star,heart,moon,flower}.png` (already present)

**Context:** Replace procedural bumper textures with custom 250×250 PNG sprites. Keep same texture keys (`bumper-star`, etc.) so all references throughout the codebase continue to work. Scale sprites to ~72px to match current visual size.

- [ ] **Step 1: Add image loads to BootScene preload()**

  In `src/scenes/BootScene.js`, modify the `preload()` method to load the 4 PNG files alongside the existing audio:

```js
  preload() {
    // Audio
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.wav');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.wav');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.wav');
    // Custom bumper sprites (250x250 PNG, transparent background)
    this.load.image('bumper-star', 'assets/images/star.png');
    this.load.image('bumper-heart', 'assets/images/heart.png');
    this.load.image('bumper-moon', 'assets/images/moon.png');
    this.load.image('bumper-flower', 'assets/images/flower.png');
  }
```

- [ ] **Step 2: Remove procedural bumper generation from generateAssets()**

  In `src/scenes/BootScene.js`, remove the following blocks from `generateAssets()`:

  Remove star bumper generation (current lines ~29-38):
```js
    // Star bumper — neon yellow
    g.clear();
    this.drawStar(g, 40, 40, 5, 36, 18);
    g.fillStyle(0xffe066);
    g.fill();
    g.lineStyle(3, 0xffcc00);
    g.stroke();
    g.fillStyle(0xffe066, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-star', 80, 80);
```

  Remove moon bumper generation (current lines ~40-49):
```js
    // Moon bumper — neon purple
    g.clear();
    this.drawMoon(g, 40, 40, 36);
    g.fillStyle(0xc77dff);
    g.fill();
    g.lineStyle(3, 0x9d4edd);
    g.stroke();
    g.fillStyle(0xc77dff, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-moon', 80, 80);
```

  Remove heart bumper generation (current lines ~51-60):
```js
    // Heart bumper — neon pink
    g.clear();
    this.drawHeart(g, 40, 40, 36);
    g.fillStyle(0xff6b9d);
    g.fill();
    g.lineStyle(3, 0xe94560);
    g.stroke();
    g.fillStyle(0xff6b9d, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-heart', 80, 80);
```

  Remove flower bumper generation (current lines ~62-71):
```js
    // Flower bumper — neon green
    g.clear();
    this.drawFlower(g, 40, 40, 36);
    g.fillStyle(0x57fb88);
    g.fill();
    g.lineStyle(3, 0x00f5a0);
    g.stroke();
    g.fillStyle(0x57fb88, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-flower', 80, 80);
```

- [ ] **Step 3: Remove procedural bumper helper methods**

  Remove all four methods from `src/scenes/BootScene.js`:
  - `drawStar(g, cx, cy, points, outerR, innerR)` — entire method
  - `drawMoon(g, cx, cy, r)` — entire method
  - `drawHeart(g, cx, cy, size)` — entire method
  - `drawFlower(g, cx, cy, r)` — entire method

- [ ] **Step 4: Scale bumper sprites in GameScene buildBumpers()**

  In `src/scenes/GameScene.js`, in `buildBumpers()`, add `.setScale(0.288)` to the bumper sprite creation:

```js
      // Visual bumper sprite (no physics)
      const bumper = this.add.image(def.x, def.y, def.key);
      bumper.setScale(0.288);
```

  The scale factor 0.288 = 72/250, matching the 250px source image to the current ~72px visual size.

- [ ] **Step 5: Verify in browser**

  Run: `npm run dev`
  Open browser to localhost:5173. Verify:
  - All 4 bumper types show custom kandi sprites (star, heart, moon, flower)
  - Bumpers are roughly the same visual size as before (~72px)
  - Bumper hit collision detection works (ball bounces off bumpers, score increases)
  - Background decorative shapes use new sprites
  - Bumper glow pulse animation is visible
  - No console errors about missing textures

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BootScene.js src/scenes/GameScene.js
git commit -m "feat: replace procedural bumpers with custom kandi sprites

Load star.png, heart.png, moon.png, flower.png from public/assets/images/.
Scale to 0.288 (~72px) to match existing bumper size. Remove procedural
generation code and helper methods."
```

---

### Task 3: Tapered Flipper Shape

**Files:**
- Modify: `src/scenes/BootScene.js` — generateAssets() (replace flipper texture generation)
- Modify: `src/scenes/GameScene.js` — buildFlippers() (replace rectangle physics bodies with fromVertices)

**Context:** Change flipper from rounded rectangle to tapered shape (28px pivot → 8px tip). Physics body changes from rectangle to custom vertices using Matter.js `fromVertices`. Must correct for centroid offset after body creation.

- [ ] **Step 1: Generate tapered flipper texture in BootScene**

  In `src/scenes/BootScene.js`, replace the flipper generation block (current lines ~79-85) with a tapered polygon:

```js
    // Flipper — tapered shape, wide at pivot (28px), narrow at tip (8px)
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    g.beginPath();
    // Pivot end (left, wide 28px tall) → tip end (right, 8px tall)
    g.moveTo(0, 0);
    g.lineTo(0, 28);           // pivot end bottom
    g.lineTo(140, 20);         // taper starts
    g.quadraticCurveTo(156, 18, 156, 14);  // tip bottom corner (rounded)
    g.lineTo(156, 10);         // tip top
    g.quadraticCurveTo(156, 6, 140, 8);   // tip top corner (rounded)
    g.lineTo(0, 0);            // back to pivot top
    g.closePath();
    g.fill();
    g.stroke();
    g.generateTexture('flipper', 156, 28);
```

  This draws a tapered shape: 28px tall at x=0 (pivot), ~8px tall at x=156 (tip), with rounded corners at the tip. Same colors, same texture key, same dimensions.

- [ ] **Step 2: Replace flipper physics bodies with fromVertices**

  In `src/scenes/GameScene.js`, in `buildFlippers()`, replace the two `this.matter.add.rectangle()` calls with `this.matter.add.body(Matter.Bodies.fromVertices(...))` calls.

  Replace left flipper body (current lines ~179-184):

```js
    // Dynamic physics body for left flipper — tapered trapezoid via fromVertices
    const leftFlipperVerts = [
      { x: -78, y: -14 },  // pivot-end top (wide)
      { x: 78,  y: -4 },   // tip-end top (narrow)
      { x: 78,  y: 4 },    // tip-end bottom (narrow)
      { x: -78, y: 14 },   // pivot-end bottom (wide)
    ];
    this.leftFlipperBody = this.matter.add.body(
      Matter.Bodies.fromVertices(199.8, 820, leftFlipperVerts, {
        restitution: 0.2,
        friction: 0.4,
        isSleepingAllowed: false
      }, true)
    );
    // fromVertices computes centroid, not the passed (x,y) — correct position
    Matter.Body.setPosition(this.leftFlipperBody, { x: 199.8, y: 820 });
```

  Replace right flipper body (current lines ~198-203):

```js
    // Dynamic physics body for right flipper — mirrored trapezoid
    const rightFlipperVerts = [
      { x: 78,  y: -14 },  // pivot-end top (wide)
      { x: -78, y: -4 },   // tip-end top (narrow)
      { x: -78, y: 4 },    // tip-end bottom (narrow)
      { x: 78,  y: 14 },   // pivot-end bottom (wide)
    ];
    this.rightFlipperBody = this.matter.add.body(
      Matter.Bodies.fromVertices(436.2, 820, rightFlipperVerts, {
        restitution: 0.2,
        friction: 0.4,
        isSleepingAllowed: false
      }, true)
    );
    // fromVertices computes centroid, not the passed (x,y) — correct position
    Matter.Body.setPosition(this.rightFlipperBody, { x: 436.2, y: 820 });
```

  **IMPORTANT:** The `Matter.Bodies.fromVertices` 5th parameter is `flagInternal: true` which improves collision detection. The centroid correction via `Matter.Body.setPosition` is essential — without it, the body will be offset from its intended position.

- [ ] **Step 3: Verify in browser**

  Run: `npm run dev`
  Open browser to localhost:5173. Verify:
  - Flipper textures show tapered shape (wide at pivot end, narrow at tip)
  - Left flipper tip points rightward, right flipper tip points leftward
  - Flipper actuation works: press A/Left for left flipper, D/Right for right flipper
  - Ball collision with flippers feels natural — ball should launch upward when flipped
  - No explosive ball deflections or tunneling through flippers
  - Flipper rest/active angles unchanged visually

  **If flippers don't work correctly:** The most common issue is centroid offset. Check that `Matter.Body.setPosition` is called immediately after body creation. If the flipper body is visibly offset from the sprite, the centroid correction is wrong.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BootScene.js src/scenes/GameScene.js
git commit -m "feat: taper flipper shape from 28px pivot to 8px tip

Replace rounded rectangle flipper with tapered polygon texture.
Use Matter.js fromVertices for physics body to match tapered shape.
Correct for centroid offset after body creation."
```

---

### Task 4: Animated HUD Labels with Score Pop

**Files:**
- Modify: `index.html` — add Google Font import, restructure HUD HTML, add CSS animations
- Modify: `src/scenes/GameScene.js` — updateScoreDisplay() (add pop animation), create() (update DOM selector), loseLife() (update DOM selector)

**Context:** Add "SCORE:" and "HI SCORE:" labels with rainbow wave animation. Score values pop/shake when they increase. Uses Fredoka One Google Font for kandi aesthetic.

- [ ] **Step 1: Add Google Font import to index.html**

  In `index.html`, add the Google Font `<link>` tags inside `<head>`, before the existing `<style>` block:

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Restructure HUD HTML in index.html**

  Replace the `<div id="game-header">` block with:

```html
    <div id="game-header">
      <span id="high-score">
        <span class="hud-label">HI SCORE:</span>
        <span id="hi-value">0</span>
      </span>
      <span id="score-display">
        <span class="hud-label">SCORE:</span>
        <span id="score-value">0</span>
      </span>
      <span id="lives-display">&#9675;&#9675;&#9675;</span>
    </div>
```

- [ ] **Step 3: Add CSS animations to index.html**

  In the `<style>` block of `index.html`, add the following CSS. Update the existing `#score-display` and `#high-score` styles, and add new rules:

```css
    /* Font import for Phaser text fallback */
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');

    /* HUD label — rainbow wave animation */
    .hud-label {
      font-family: 'Fredoka One', Arial, sans-serif;
      font-weight: bold;
      display: inline-block;
      animation: rainbow-wave 3s ease-in-out infinite;
    }

    /* Rainbow color cycle through game palette */
    @keyframes rainbow-wave {
      0%, 100% {
        color: #ff6b6b;
        transform: rotate(-1.5deg) scale(1);
      }
      16% {
        color: #ffe066;
        transform: rotate(1.5deg) scale(1.02);
      }
      33% {
        color: #57fb88;
        transform: rotate(-1.5deg) scale(1);
      }
      50% {
        color: #00f5ff;
        transform: rotate(1.5deg) scale(1.02);
      }
      66% {
        color: #c77dff;
        transform: rotate(-1.5deg) scale(1);
      }
      83% {
        color: #ff6bd6;
        transform: rotate(1.5deg) scale(1.02);
      }
    }

    /* Score value — base style + pop animation */
    #score-value, #hi-value {
      font-family: 'Fredoka One', Arial, sans-serif;
      display: inline-block;
      transition: transform 0.05s ease-out;
    }

    /* Score pop — triggered via JS class toggle */
    .score-pop {
      animation: score-pop-anim 0.15s ease-out;
    }

    @keyframes score-pop-anim {
      0% { transform: scale(1) translateX(0); }
      25% { transform: scale(1.15) translateX(-2px); }
      50% { transform: scale(1.1) translateX(2px); }
      75% { transform: scale(1.05) translateX(-1px); }
      100% { transform: scale(1) translateX(0); }
    }
```

  Also update the existing `#score-display` style to use Fredoka One:

```css
    #score-display {
      font-size: clamp(16px, 4vw, 32px);
      font-weight: bold;
      font-family: 'Fredoka One', Arial, sans-serif;
      text-shadow: 2px 2px 4px #000;
      color: #ffffff;
    }
```

  And update `#high-score`:

```css
    #high-score {
      font-size: clamp(10px, 2vw, 16px);
      font-family: 'Fredoka One', Arial, sans-serif;
      color: #0ff0fc;
      text-shadow: 1px 1px 3px #000;
    }
```

- [ ] **Step 4: Update GameScene DOM selectors**

  In `src/scenes/GameScene.js`:

  a) Update `create()` — replace high score display line (~line 41):

```js
    document.getElementById('hi-value').textContent = highScore;
```

  b) Update `updateScoreDisplay()` — add pop animation trigger:

```js
  updateScoreDisplay() {
    const el = document.getElementById('score-value');
    el.textContent = this.score;
    // Trigger pop animation
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  }
```

  c) Update `loseLife()` — replace high score display line (~line 537):

```js
      document.getElementById('hi-value').textContent = newHigh;
```

- [ ] **Step 5: Verify in browser**

  Run: `npm run dev`
  Open browser to localhost:5173. Verify:
  - "SCORE:" and "HI SCORE:" labels are visible with rainbow color cycling
  - Labels oscillate with subtle wave effect (±1.5° rotation, slight scale pulse)
  - Score value pops/shakes when score increases (hit a bumper)
  - Score value does NOT pop on game start or life respawn
  - High score value displays correctly at game start and after game over
  - Fredoka One font loads and renders correctly
  - HTML layout remains centered and responsive
  - On mobile viewport, labels don't overflow or wrap awkwardly

- [ ] **Step 6: Commit**

```bash
git add index.html src/scenes/GameScene.js
git commit -m "feat: add animated rainbow HUD labels with score pop effect

Restructure HUD to include SCORE: and HI SCORE: labels. Rainbow wave
animation cycles through game palette colors. Score value pops on increase.
Uses Fredoka One Google Font for kandi aesthetic."
```

---

## Verification Checklist (All Features Complete)

Run `npm run dev` and verify:
- [ ] Game loads without console errors
- [ ] Screen shakes when ball drains (all 3 lives)
- [ ] Custom bumper sprites display correctly at all 10 bumper positions
- [ ] Bumper collision detection works (ball bounces, score increases)
- [ ] Flippers show tapered shape and actuate correctly
- [ ] Ball collision with flippers feels natural
- [ ] HUD labels show rainbow wave animation
- [ ] Score value pops when score increases
- [ ] High score persists across game sessions
- [ ] Game over screen works correctly
- [ ] Ball respawn and relaunch work correctly
- [ ] No visual artifacts or flickering
