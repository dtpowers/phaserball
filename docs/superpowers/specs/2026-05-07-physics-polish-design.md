# Physics Polish & Layout — Launch Closure, Tunneling, Responsive HUD

## Summary

Four changes: guard the launch lane closure with an x-coordinate check to prevent premature trapping, boost launch velocity by 50% to compensate for the lower speed cap, add a two-layer velocity cap to eliminate wall tunneling, and restructure the page layout for reliable centering and responsive HUD scaling.

## Problem Statement

### Issue 1: Launch lane closure triggers too early

The launch lane closure wall appears when `ball.x > 620 && ball.y < 520 && ball.vy < 0` — i.e., while the ball is still inside the launch lane and moving upward. Because the closure body (a 75px angled rectangle at x=656) extends into the lane, the ball can collide with it before fully clearing into the play area, causing it to deflect back down the lane or get trapped.

**Root cause:** The condition requires the ball to be *in* the lane (`x > 620`) to trigger the closure, so the wall appears alongside the ball rather than behind it.

### Issue 2: Launch velocity too weak

Even at full charge, the ball barely exits the launch lane. With the lower speed cap (Issue 3), the launch will feel even weaker. The current `velScale` of `0.00625` yields a max y-velocity of only -17.5 px/s at full power, which is insufficient to reliably carry the ball past the divider.

### Issue 3: Ball tunnels through walls at high speed

The existing manual speed clamp (300 px/s) is insufficient in edge cases — bumper bounces with restitution 1.2 can impart impulses that push the ball far enough in a single frame to pass through thin walls (16px thick) without Matter.js detecting a collision. Once the ball escapes the table boundaries, it's lost.

### Issue 4: Page layout breaks on different screen sizes

The HUD elements use fixed pixel font sizes (32px score, 18px lives, 16px high-score) with no gap between them, causing overlap on narrow screens. The game canvas relies on Phaser's FIT scaling but the HTML wrapper doesn't guarantee proper vertical centering or spacing between the header and canvas.

## Changes

### 1. Launch lane closure x-coordinate guard

**File:** `src/scenes/GameScene.js` — `update()` method, launch closure block (~line 479)

Replace the closure trigger condition:

**Before:**
```js
if (this.ball && !this.launchClosureActive &&
    this.ball.x > 620 && this.ball.y < 520 && this.ball.body.velocity.y < 0)
```

**After:**
```js
if (this.ball && !this.launchClosureActive &&
    this.ball.x < 600 && this.ball.y < 520 && this.ball.body.velocity.y < 0)
```

**Why this works:** The launch lane divider ends at y=512. For the ball to reach `x < 600` while `y < 520`, it must have passed above the divider and entered the play area. The closure only seals after the ball is safely clear. Once sealed, the ball cannot return to the launch lane because the divider (x=620, y=512-1024) and closure (angled at y=510) form a continuous barrier.

**Threshold rationale:** `x < 600` places the ball 20px to the left of the divider's outer edge (x=612), ensuring it's well into the main play area.

### 2. Increase launch velocity scale

**File:** `src/scenes/GameScene.js` — `LAUNCH` constant (lines 5-11)

Increase `velScale` by 50% from `0.00625` to `0.009375`:

```js
const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.6,
  baseVel:    5,
  velScale:   0.009375,
  xVel:       -10
};
```

This bumps the max y-velocity at full charge from -17.5 to -26.25 px/s, ensuring the ball reliably clears the launch lane divider even with the lower speed cap.

### 3. Two-layer tunneling prevention

**File:** `src/scenes/GameScene.js` — `update()` clamp block and `spawnBall()` method.

**Layer A — Lower speed clamp (in `update()`):**

Reduce `maxSpeed` from 300 to 200 px/s in the existing velocity clamp block (~line 463):

```js
const maxSpeed = 200;
```

This keeps the ball fast and responsive while giving Matter.js more headroom to detect collisions at the table's boundaries.

**Layer B — Tighter collision tolerance (in `spawnBall()`):**

Add `slop: 0.01` to the ball's Matter body options (default is 0.05). This tightens the collision overlap threshold, making collision detection more precise:

```js
this.ball = this.matter.add.image(652, 950, 'ball', null, {
  restitution: 0.8,
  friction: 0,
  frictionAir: 0.0001,
  density: 0.001,
  slop: 0.01,
  shape: { type: 'circle', radius: 16 }
});
```

**Layer C — World bounds safety net (in `create()`):**

After `this.buildTable()`, add world boundary collision so any ball that somehow tunnels through a table wall bounces off the invisible world edge rather than escaping entirely:

```js
this.matter.world.setBounds(0, 0, 700, 1050, true, true, true, true);
```

The last four `true` parameters enable collision on right, bottom, left, and top world edges respectively.

### 4. Responsive page layout

**File:** `index.html` — `<style>` block and HTML structure

**HTML structure change:** Wrap header and game container in a flex column:

```html
<div id="game-wrapper">
  <div id="game-header">
    <span id="high-score">HI: 0</span>
    <span id="score-display">0</span>
    <span id="lives-display">Hearts: 3</span>
  </div>
  <div id="game-container"></div>
</div>
```

**CSS changes:**

```css
#game-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(4px, 1vh, 16px);
  gap: clamp(4px, 1vh, 12px);
}

#game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 700px;
  padding: clamp(4px, 1vw, 12px) clamp(8px, 2vw, 24px);
  font-family: Arial, sans-serif;
  color: #ffffff;
  gap: clamp(8px, 2vw, 24px);
  box-sizing: border-box;
}

#score-display {
  font-size: clamp(16px, 4vw, 32px);
  font-weight: bold;
  text-shadow: 2px 2px 4px #000;
}

#lives-display {
  font-size: clamp(12px, 2.5vw, 18px);
  color: #ff6b9d;
  text-shadow: 1px 1px 3px #000;
}

#high-score {
  font-size: clamp(10px, 2vw, 16px);
  color: #0ff0fc;
  text-shadow: 1px 1px 3px #000;
}

#game-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
}
```

**Key behaviors:**
- `clamp()` ensures font sizes scale between min/max viewport bounds
- `gap` on `#game-header` prevents HUD elements from overlapping
- `#game-container` with `flex: 1` and `min-height: 0` gives Phaser's FIT scaler proper space to work
- `max-width: 700px` on header keeps it aligned with the game canvas width

## Files Changed

| File | Changes |
|------|---------|
| `src/scenes/GameScene.js` | Closure x-check (Issue 1), launch velocity (Issue 2), speed clamp + slop (Issue 3), world bounds (Issue 3) |
| `index.html` | HTML wrapper + responsive CSS (Issue 4) |

## Verification

1. **Launch closure:** Launch the ball. The closure wall should appear only after the ball has clearly entered the play area (left of x=600). The ball should never deflect off the closure or get trapped.
2. **Launch velocity:** Full-power launch should reliably carry the ball past the divider and into the main play area. The ball should feel snappy, not sluggish.
3. **Tunneling:** Play aggressively — hit bumpers at high speed, spam flippers. The ball should never escape the table boundaries. If it does, it should bounce off the world edge and re-enter play.
4. **Speed feel:** The ball should still feel fast and snappy. Bumper bounces should be energetic. The lower cap (200 vs 300) should not noticeably dull gameplay.
5. **Layout:** Resize the browser window from mobile-width (~320px) to desktop (~1400px). The HUD should scale, elements should never overlap, and the game canvas should always be centered.
6. **Regression:** Scoring, lives, game over, touch controls, flipper mechanics all still work.
