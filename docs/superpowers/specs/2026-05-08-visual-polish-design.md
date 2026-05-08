# Visual Polish Pass - Design Spec

**Date:** 2026-05-08
**Status:** Draft

## Overview

A comprehensive visual polish pass for Earkandi Pinball, focused on making the game feel more impactful and visually aligned with the earkandi kandi/raver brand aesthetic. Four independent improvements: screen shake on life loss, custom bumper sprites, tapered flipper shapes, and animated HUD labels.

## Feature 1: Screen Shake on Life Lost

### What
Add a camera shake effect when the player loses a life (ball drains off the table).

### Why
Life loss is the most negative event in the game. A screen shake adds visceral impact, reinforcing the significance of losing a ball without needing additional UI elements.

### Implementation

- **Location:** `GameScene.loseLife()` method in `src/scenes/GameScene.js`, called after `this.sound.play('ball-drain')`
- **API:** `this.cameras.main.shake(duration, intensity)`
- **Parameters:** 200ms duration, 0.03 intensity
  - 200ms: short enough to not disorient, long enough to register
  - 0.03: subtle shake (~2.1px offset on a 700px canvas), impactful without being overwhelming

### Code Change

```js
// In loseLife(), after this.sound.play('ball-drain'):
this.cameras.main.shake(200, 0.03);
```

### Verification
- Shake triggers on each life drain (lives 3->2, 2->1, 1->0)
- Does NOT trigger on bumper hits, flipper actuation, or ball spawn
- No visual artifacts after shake completes

---

## Feature 2: Custom Bumper Sprites

### What
Replace the 4 procedurally generated bumper textures (star, moon, heart, flower) with custom PNG sprites provided in `public/assets/images/`.

### Why
Custom kandi-themed art aligns the game visuals with the earkandi brand identity. Procedural shapes are generic; hand-designed art gives the game its own personality.

### Source Assets

| File | Dimensions | Format |
|------|-----------|--------|
| `star.png` | 250x250 | PNG, RGBA, transparent background |
| `heart.png` | 250x250 | PNG, RGBA, transparent background |
| `moon.png` | 250x250 | PNG, RGBA, transparent background |
| `flower.png` | 250x250 | PNG, RGBA, transparent background |

### Implementation

**BootScene changes:**
1. Add assets to `public/assets/images/` (already done)
2. In `preload()`, load the 4 PNG files:
   ```js
   this.load.image('bumper-star', 'assets/images/star.png');
   this.load.image('bumper-heart', 'assets/images/heart.png');
   this.load.image('bumper-moon', 'assets/images/moon.png');
   this.load.image('bumper-flower', 'assets/images/flower.png');
   ```
3. In `generateAssets()`, remove all procedural bumper generation code:
   - Star: lines 29-38 (drawStar call + generateTexture)
   - Moon: lines 40-49 (drawMoon call + generateTexture)
   - Heart: lines 51-60 (drawHeart call + generateTexture)
   - Flower: lines 62-71 (drawFlower call + generateTexture)
4. Remove helper methods: `drawStar()`, `drawMoon()`, `drawHeart()`, `drawFlower()` (lines 150-195)

**GameScene changes:**
1. In `buildBumpers()`, scale sprite to match current visual size:
   - Current bumper physics: circle radius 36px (~72px diameter)
   - New sprite scale: `bumper.setScale(0.288)` (72/250 = 0.288)
2. Glow overlay radius unchanged at 48px — already appropriate for the scaled sprites
3. Collision detection unchanged — static circle radius 36, `bumperData` callback pattern remains the same
4. Bumper hit scale pulse tween unchanged — `scaleX: 1.3, scaleY: 1.3` works on the base scale

**Background decorative shapes:**
- `addBackground()` references the same texture keys (`bumper-star`, etc.) at 0.2 scale — no change needed since keys remain the same

### Verification
- All 4 bumper types display custom sprites at correct positions
- Bumper hit collision detection works identically to before
- Background decorative shapes use new sprites
- GameOverScene decorative shapes use new sprites
- Bumper glow pulse animation visible around new sprites
- No console errors about missing textures

---

## Feature 3: Tapered Flipper Shape

### What
Change the flipper from a rounded rectangle to a tapered shape: 28px tall at the pivot end, narrowing to 8px at the tip. Flipper length remains 156px, position and pivot point unchanged.

### Why
Real pinball flippers taper toward the tip for more precise ball control. The tapered shape improves visual authenticity and gives the flipper a more purposeful, mechanical appearance.

### Implementation

**BootScene — new flipper texture:**
Replace the rounded rectangle flipper generation (lines 79-85) with a tapered polygon:

- Draw a 5-vertex shape:
  - Pivot end: rectangle from `(0, 0)` to `(20, 28)` with a rounded outer corner (radius 4px)
  - Tip end: tapers linearly to 8px height at x=156
  - Top edge: line from `(20, 0)` to `(156, 10)` — centers the 8px tip at y=14
  - Bottom edge: line from `(20, 28)` to `(156, 18)` — centers the 8px tip at y=14
  - Tip: rounded corner at the narrow end (radius 4px)
- Keep same colors: fill `0x00b4d8`, stroke `0x00f5ff`
- Texture size remains 156×28 for pixel-perfect alignment
- Generate texture with same key: `'flipper'`

**GameScene — physics body:**
Replace `this.matter.add.rectangle()` with `this.matter.add.fromVertices()` using custom
vertices that match the tapered visual shape.

**Why not trapezoid?** `Matter.Bodies.trapezoid` tapers along the Y axis (top vs bottom edges),
but our flipper tapers along the X axis (pivot end vs tip end). Custom vertices are needed for
the correct orientation.

**Left flipper body vertices** (relative to body center at origin, then positioned at world coords):
The flipper is 156px long (x: -78 to +78 from center) and 28px tall at the pivot end (y: -14 to +14).
The tip tapers to 8px tall (y: -4 to +4).

```js
// Left flipper — wide end at -X (pivot), narrow end at +X (tip)
const leftFlipperVerts = [
  { x: -78, y: -14 },  // pivot-end top
  { x: 78,  y: -4 },   // tip-end top
  { x: 78,  y: 4 },    // tip-end bottom
  { x: -78, y: 14 },   // pivot-end bottom
];

this.leftFlipperBody = this.matter.add.body(
  Matter.Bodies.fromVertices(199.8, 820, leftFlipperVerts, {
    restitution: 0.2,
    friction: 0.4,
    isSleepingAllowed: false
  }, true)  // flagInternal: true for better collision behavior
);
```

**Right flipper body vertices** — mirrored (wide end at +X/pivot, narrow end at -X/tip):
```js
const rightFlipperVerts = [
  { x: 78,  y: -14 },  // pivot-end top
  { x: -78, y: -4 },   // tip-end top
  { x: -78, y: 4 },    // tip-end bottom
  { x: 78,  y: 14 },   // pivot-end bottom
];

this.rightFlipperBody = this.matter.add.body(
  Matter.Bodies.fromVertices(436.2, 820, rightFlipperVerts, {
    restitution: 0.2,
    friction: 0.4,
    isSleepingAllowed: false
  }, true)
);
```

**Note on `fromVertices`:** Matter.js computes the centroid of the vertex set, NOT the passed (x,y)
coordinate. The body's final world position will be offset by the computed centroid. After creation,
use `Matter.Body.setPosition()` to correct the body to its intended world position. This is standard
Matter.js behavior for convex hull bodies.

**Constraint attachment points unchanged:**
- Left flipper: pivot at `(121.6, 820)`, constraint offset `pointB: { x: -78, y: 0 }`
- Right flipper: pivot at `(514.4, 820)`, constraint offset `pointB: { x: 78, y: 0 }`

**Sync in update() unchanged:**
- Position/angle sync logic remains the same — physics body still follows the visual sprite

### Trade-offs
- **fromVertices vs rectangle:** `fromVertices` creates a convex hull that precisely matches the
  tapered visual shape. Matter.js may decompose concave shapes into multiple simple bodies, but our
  4-vertex trapezoid is convex — no decomposition needed, single convex body.
- **Physics accuracy:** The tapered body gives slightly different ball deflection at the flipper tip
  (ball hits a narrower face) vs the flat rectangle. This is more physically accurate and improves
  flipper control precision.

### Verification
- Flipper textures show tapered shape (wide at pivot, narrow at tip)
- Left flipper tip points rightward, right flipper tip points leftward
- Flipper actuation (tween rotation) works identically to before
- Ball collision with flippers feels natural, no explosive deflections
- Flipper rest/active angles unchanged: rest ±20°, active ∓30°

---

## Feature 4: Animated HUD Labels

### What
Restructure the HTML score/high-score display to include styled labels ("SCORE:", "HI SCORE:") with rainbow color animation and subtle wave effect. Score values animate with a pop/shake effect when they increase.

### Why
The current plain-number HUD is functional but unexciting. Rainbow labels add visual energy that matches the earkandi kandi aesthetic. Score pop feedback makes scoring feel more satisfying and responsive.

### Implementation

**A. Font loading (index.html `<head>`):**
Add Google Font import:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap" rel="stylesheet">
```

**B. HTML restructuring (index.html):**
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
  <span id="lives-display">⚪⚪⚪</span>
</div>
```

**C. CSS styles (index.html `<style>`):**

```css
/* Font import */
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');

/* HUD label base style */
.hud-label {
  font-family: 'Fredoka One', Arial, sans-serif;
  font-weight: bold;
  display: inline-block;
  animation: rainbow-wave 3s ease-in-out infinite;
}

/* Rainbow color cycle */
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

/* Score value base style */
#score-value, #hi-value {
  font-family: 'Fredoka One', Arial, sans-serif;
  display: inline-block;
  transition: transform 0.05s ease-out;
}

/* Score pop animation */
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

**D. GameScene.js changes:**

Update `updateScoreDisplay()` to trigger pop animation:
```js
updateScoreDisplay() {
  const el = document.getElementById('score-value');
  el.textContent = this.score;
  // Trigger pop animation
  el.classList.remove('score-pop');
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('score-pop');
}
```

Update `create()` to use new element IDs:
```js
// Replace:
// document.getElementById('high-score').textContent = 'HI: ' + highScore;
// With:
document.getElementById('hi-value').textContent = highScore;
```

Update `loseLife()` high score update:
```js
// Replace:
// document.getElementById('high-score').textContent = 'HI: ' + newHigh;
// With:
document.getElementById('hi-value').textContent = newHigh;
```

**E. GameOverScene.js changes:**
No changes to Phaser-rendered text — the scene overlay is independent of the HTML HUD. However, for consistency, consider updating GameOverScene title text to use Fredoka One font if/when a web font is loaded in Phaser (out of scope for this pass).

### Animation Timing Details

| Effect | Duration | Repeat | Easing |
|--------|----------|--------|--------|
| Rainbow wave (labels) | 3s | Infinite | ease-in-out |
| Score pop (on increase) | 150ms | Once per score change | ease-out |
| Label rotation amplitude | — | — | ±1.5° |
| Label scale amplitude | — | — | 1.0→1.02 |

### Design Rationale

- **Rainbow colors chosen** match existing game palette: `#ff6b6b` (pink-red, close to existing `#e94560`), `#ffe066` (star bumper yellow), `#57fb88` (flower bumper green), `#00f5ff` (flipper cyan), `#c77dff` (moon bumper purple), `#ff6bd6` (heart bumper pink)
- **Wave amplitude is subtle** (±1.5° rotation, 2% scale) — noticeable but not distracting from gameplay
- **Score pop is fast** (150ms) — registers as a satisfying "bump" without lingering
- **Fredoka One** font is rounded, bold, and playful — matches the kandi/raver aesthetic without being overly decorative

### Verification
- "SCORE:" and "HI SCORE:" labels visible with rainbow color cycling
- Labels oscillate with subtle wave effect
- Score value pops/shakes when score increases (bumper hit)
- Score value does NOT pop on game start or life respawn
- High score value displays correctly
- HTML layout remains responsive on mobile viewports
- Font loads correctly, fallback to Arial if Google Fonts unavailable

---

## File Change Summary

| File | Changes |
|------|---------|
| `index.html` | Restructure HUD HTML, add CSS animations, add Google Font import |
| `src/scenes/BootScene.js` | Load 4 PNG sprites in preload(), remove procedural bumper generation code, replace flipper texture with tapered polygon |
| `src/scenes/GameScene.js` | Add camera shake in loseLife(), scale bumper sprites, use trapezoid physics bodies for flippers, update score display DOM calls, add score pop animation trigger |

## Out of Scope

- GameOverScene font/styling updates (could be a follow-up pass)
- Particle effects on bumper hit (could be a follow-up pass)
- Sound design changes
- Mobile-specific HUD adjustments beyond responsive CSS already in place
