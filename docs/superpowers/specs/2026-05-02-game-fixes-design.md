---
name: Game Fixes — Launch Power, Wall Visibility, UI Placement, Shape Motion, Funnel/Layout
---

# Game Fixes — Post Matter.js Migration

## Problem

Five issues exist after the Arcade→Matter.js physics migration:

1. **Launch too fast** — Even at minimum charge, the ball rockets up the launch lane and instantly escapes. Current formula `-(launchPower + 200)` with max launchPower=1000 yields velocities of 200–1200 px/s.
2. **Walls invisible** — Matter.js static rectangle bodies have no visual rendering. The outside table walls and launch lane divider are completely invisible.
3. **UI overlaps the table** — Score, hearts, and hi score text are rendered at y=40 inside the game canvas, on top of the play area.
4. **Background shapes are static** — Decorative shapes only rotate in place with no translational motion, making the background feel dead.
5. **Funnel and dead zone too wide** — Drain gap is 150px (~4.7× ball diameter). Flippers are symmetric around table center (x=350) not play area center (~x=318). Bumpers are offset from play area center.

## Root Cause

1. Launch velocity formula has no scaling factor — raw charge value (up to 1000) plus 200 base is far too high for Matter.js physics which has different feel than Arcade.
2. `this.matter.add.rectangle()` creates physics bodies without visuals. Unlike Arcade's `this.physics.add.staticGroup()` with sprites, Matter bodies are invisible by default.
3. UI was placed at y=40 before the Matter.js migration when the top wall was different; no space was allocated above the table.
4. Only rotation tweens were added to decorative shapes — no position tweens.
5. Original geometry was designed for Arcade physics with different wall/bumper layout; not adjusted after migration.

## Files Changed

| File | Change |
|------|--------|
| `src/scenes/GameScene.js` | Launch formula, wall visuals, shape tweens, funnel/wall/flipper/bumper geometry |
| `index.html` | Add header div for score/lives/high score |
| `src/style.css` | Style header elements |

---

## Fix 1: Launch Power Reduction

### Current
```js
// Charge rate
this.launchPower = Math.min(1000, this.launchPower + delta * 0.7);

// Launch velocity
this.ball.setVelocity(-20, -(this.launchPower + 200));
```
Velocity range: 200–1200 px/s. Even a tap is too fast.

### New
```js
// Launch config constants
const LAUNCH = {
  maxPower:   2000,    // charge cap
  chargeRate: 0.5,     // px per ms → ~4s to max
  baseVel:    80,      // minimum upward velocity
  velScale:   0.1,     // scales charge into velocity
  xVel:       -15      // leftward angle out of launch lane
};

// Charge rate
this.launchPower = Math.min(LAUNCH.maxPower, this.launchPower + delta * LAUNCH.chargeRate);

// Launch velocity
this.ball.setVelocity(LAUNCH.xVel, -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale));
```
Velocity range: 80–280 px/s. Gentle tap to moderate full charge. 4s to max charge.

### Power bar update
Power bar height calculation changes to match new maxPower:
```js
this.powerBarHeight = this.launchPower * 0.1;  // was 0.2, scaled for new max
```

---

## Fix 2: Wall Visibility

### Current
Walls are invisible Matter.js physics bodies created with `this.matter.add.rectangle()`.

### New
Add a `Graphics` object after `buildTable()` that draws 8px stroke outlines around each wall:

```js
const wallGfx = this.add.graphics();
wallGfx.lineStyle(8, 0x5a5a8a, 1);

// Left wall
wallGfx.strokeRect(0, 0, 16, 1050);
// Right wall
wallGfx.strokeRect(684, 0, 16, 1050);
// Top wall
wallGfx.strokeRect(0, 0, 700, 16);
// Bottom left wall (after geometry update, see Fix 5)
wallGfx.strokeRect(16, 1008, 310, 16);
// Bottom right wall
wallGfx.strokeRect(374, 1008, 318, 16);
// Launch lane divider
wallGfx.strokeRect(612, 512, 16, 512);
```

Color 0x5a5a8a is brighter than funnel lines (0x3a3a6a) for visual hierarchy. 8px stroke is prominent without being overwhelming.

---

## Fix 3: UI Above the Table (HTML Overlay)

### Current
Score, lives, hi score are Phaser.Text objects at y=40 inside the canvas.

### New
Move all UI to HTML elements positioned in the dark margin above the canvas.

**index.html changes:**
```html
<div id="game-header">
  <span id="high-score">HI: 0</span>
  <span id="score-display">0</span>
  <span id="lives-display">Hearts: 3</span>
</div>
<div id="game-container"></div>
```

**CSS (style.css):**
```css
#game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: fit-content;
  margin: 0 auto;
  padding: 8px 16px;
  font-family: Arial, sans-serif;
  color: #ffffff;
}

#score-display {
  font-size: 32px;
  font-weight: bold;
  text-shadow: 2px 2px 4px #000;
}

#lives-display {
  font-size: 18px;
  color: #ff6b9d;
  text-shadow: 1px 1px 3px #000;
}

#high-score {
  font-size: 16px;
  color: #0ff0fc;
  text-shadow: 1px 1px 3px #000;
}
```

**GameScene changes:**
- Remove `this.scoreText`, `this.livesText`, `this.highScoreText` from `buildUI()`
- Remove "earkandi PINBALL" text from `addBackground()`
- `updateScoreDisplay()` → `document.getElementById('score-display').textContent = this.score`
- `updateLivesDisplay()` → `document.getElementById('lives-display').textContent = 'Hearts: ' + this.lives`
- High score updates via same DOM reference in `loseLife()`

---

## Fix 4: Background Shape Drift

### Current
Only rotation tweens on decorative shapes.

### New
Add a position tween alongside the existing rotation tween. Each shape drifts 8-15px in a random direction, then yoyos back:

```js
this.tweens.add({
  targets: shape,
  x: shape.x + Phaser.Math.Between(-15, 15),
  y: shape.y + Phaser.Math.Between(-15, 15),
  duration: Phaser.Math.Between(8000, 15000),
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});
```

Yoyo + Sine.easeInOut creates gentle drift out, pause, drift back. Different random durations per shape prevent synchronized motion.

---

## Fix 5: Funnel Narrowing, Dead Zone, Flipper/Bumper Repositioning

### Current Geometry
- Drain gap: x=275→425 = **150px** (4.7× ball diameter)
- Bottom left wall: center(145, 1016), 260×16
- Bottom right wall: center(555, 1016), 260×16
- Funnel left: (16,700)→(275,1016), midpoint(145,858)
- Funnel right: (620,700)→(425,1016), midpoint(522,858)
- Flippers: left(190,820), right(510,820) — symmetric around x=350 (table center)
- Bumpers centered around x=340 (old table center)

### New Geometry

**Drain gap:** x=326→374 = **48px** (1.5× ball diameter of 32px), centered at x=350 (table center)

**Bottom walls:**
- Bottom left: x=16→326, width=310, center(95, 1016)
- Bottom right: x=374→692, width=318, center(533, 1016)

**Funnel:**
- Left funnel: (16,700)→(326,1016), midpoint(171, 858), length ~440px
  - Angle: `Phaser.Math.Angle.Between(16, 700, 326, 1016)`
- Right funnel: (564,700)→(374,1016), midpoint(469, 858), length ~440px
  - Angle: `Phaser.Math.Angle.Between(564, 700, 374, 1016)`

**Flippers:** No change — original positions (190, 820) and (510, 820) are already symmetric around x=350 and equidistant from funnel edges (136px each).

**Bumpers:** Minimal shift — outer bumpers move ~10px toward center to maintain symmetry around x=350.

| Type | Old positions | New positions |
|------|--------------|---------------|
| Flower | (312, 80) | (312, 80) — unchanged |
| Stars | (180,160), (340,140), (500,160) | (186,160), (340,140), (494,160) |
| Hearts | (260,250), (420,250) | (266,250), (414,250) |
| Moons | (200,350), (340,330), (480,350) | (206,350), (340,330), (474,350) |

Symmetry check — pairs equidistant from x=350:
- Stars: 350-186=164, 494-350=144 (original asymmetry preserved)
- Hearts: 350-266=84, 414-350=64 (original asymmetry preserved)
- Moons: 350-206=144, 474-350=124 (original asymmetry preserved)
- Center bumpers: flower(312), star(340), moon(340) — unchanged
- Flipper pivots: 350-190=160, 510-350=160

### Funnel visual lines
Update funnel visual graphics to match new endpoints:
```js
funnelGfx.lineBetween(16, 700, 326, 1016);
funnelGfx.lineBetween(564, 700, 374, 1016);
```

### Re-launch detection
No change — ball is in launch lane when x > 620 (launch lane divider position unchanged).

---

## What Stays the Same

- Visual rendering (graphics, textures, decorative shape assets)
- Bumper scoring values (star=100, heart=150, moon=200, flower=250)
- Lives system (3 lives, localStorage high score)
- Input handling (keyboard + touch)
- Flipper tween animation and angles
- Audio SFX pipeline
- Game state flow (spawn → launch → play → drain → respawn → game over)
- Matter.js physics configuration
- Ball physics properties (restitution, friction, density)

## Testing

1. Ball launches at controllable speed — tap gives slow rise, full charge is snappy but visible
2. All walls are visible with 8px purple stroke
3. Score, hearts, hi score appear in HTML header above the canvas
4. Background shapes drift gently while rotating
5. Drain gap is ~48px (1.5× ball diameter) and centered at x=350
6. Funnel guides ball correctly toward narrowed drain
7. Flippers are equidistant from funnel edges and symmetric around table center
8. Ball bounces correctly off all bumpers with proper scoring
9. Re-launch works unlimited times while ball stays in launch lane
10. All 3 lives drain and respawn correctly through the narrower gap
11. Game over flow works
