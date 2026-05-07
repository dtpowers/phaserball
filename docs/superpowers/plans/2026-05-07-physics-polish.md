# Physics Polish & Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix launch lane closure trapping, boost launch velocity, prevent ball tunneling through walls, and make the page layout responsive.

**Architecture:** All GameScene changes touch `src/scenes/GameScene.js` — four independent edits (closure condition, launch constant, speed clamp, spawn options, world bounds). Layout changes are entirely in `index.html` CSS and HTML structure. No shared state between tasks.

**Tech Stack:** Phaser 3 (Matter physics), Vite dev server, vanilla CSS.

---

### Task 1: Launch lane closure x-coordinate guard

**Files:**
- Modify: `src/scenes/GameScene.js:479` (update() — closure trigger condition)

- [ ] **Step 1: Replace the closure trigger condition**

In `update()`, find the launch lane closure block (around line 479). Replace the condition:

```js
    // Launch lane closure — seal the lane when ball exits upward
    if (this.ball && !this.launchClosureActive && this.ball.x < 600 && this.ball.y < 520 && this.ball.body.velocity.y < 0) {
```

The only change is `this.ball.x > 620` becomes `this.ball.x < 600`. Everything else in the block stays identical.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
fix: guard launch lane closure with x-coordinate check

Change closure trigger from ball.x > 620 (in lane) to ball.x < 600
(cleared into play area) so the wall only appears after the ball
has safely exited the launch lane. Prevents premature trapping.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Increase launch velocity scale

**Files:**
- Modify: `src/scenes/GameScene.js:9` (LAUNCH.velScale constant)

- [ ] **Step 1: Increase velScale by 50%**

In the `LAUNCH` constant at the top of the file, change `velScale` from `0.00625` to `0.009375`:

```js
const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.6,
  baseVel:    5,
  velScale:   0.009375,
  xVel:       -10
};
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
feat: increase launch velocity scale by 50%

Bump velScale from 0.00625 to 0.009375 so full-power launches
reliably carry the ball past the launch lane divider. Compensates
for the lower speed cap.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Two-layer tunneling prevention

**Files:**
- Modify: `src/scenes/GameScene.js:31` (create() — add world bounds after buildTable)
- Modify: `src/scenes/GameScene.js:383` (spawnBall() — add slop option)
- Modify: `src/scenes/GameScene.js:463` (update() — lower speed clamp)

- [ ] **Step 1: Add world bounds in create()**

In `create()`, add `this.matter.world.setBounds()` immediately after `this.buildTable()`:

```js
    this.buildTable();

    // World bounds safety net — prevents ball escaping if tunneling occurs
    this.matter.world.setBounds(0, 0, 700, 1050, true, true, true, true);

    this.buildBumpers();
```

- [ ] **Step 2: Add tighter collision tolerance in spawnBall()**

In `spawnBall()`, add `slop: 0.01` to the ball's Matter body options:

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

- [ ] **Step 3: Lower the speed clamp in update()**

In the velocity clamp block in `update()` (around line 463), change `maxSpeed` from `300` to `200`:

```js
      const maxSpeed = 200;
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
fix: add three-layer tunneling prevention

- Lower ball speed clamp from 300 to 200 px/s
- Add tighter collision tolerance (slop: 0.01) to ball body
- Enable world bounds collision as safety net

Prevents ball from clipping through walls at high speed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Responsive page layout

**Files:**
- Modify: `index.html` (entire file — HTML structure and CSS)

- [ ] **Step 1: Rewrite index.html with responsive layout**

Replace the entire file content:

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
  </style>
</head>
<body>
  <div id="game-wrapper">
    <div id="game-header">
      <span id="high-score">HI: 0</span>
      <span id="score-display">0</span>
      <span id="lives-display">Hearts: 3</span>
    </div>
    <div id="game-container"></div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

Key changes from current:
- New `#game-wrapper` div wraps header and game container in a flex column
- `#game-wrapper` uses `100vh` height, flex column, centered items
- `#game-header` has `max-width: 700px`, `gap`, and responsive padding
- `#score-display`, `#lives-display`, `#high-score` use `clamp()` font sizes
- `#game-container` uses `flex: 1` with `min-height: 0` for proper FIT scaling

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: responsive page layout with viewport-based HUD scaling

Wrap header and canvas in flex column layout. Replace fixed font
sizes with clamp() for responsive scaling. Add gap between HUD
elements to prevent overlap on narrow screens.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verify all changes in browser

**Files:** none — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:5173 and verify each change**

1. **Launch closure** — Launch the ball. The closure wall should appear only after the ball has clearly entered the play area (left of x=600). The ball should never deflect off the closure or get trapped in the lane.

2. **Launch velocity** — Hold Space for a full charge, then release. The ball should fly out of the launch lane with authority, clearing the divider and entering the main play area with visible speed.

3. **Tunneling** — Play aggressively: hit bumpers at high speed, spam flippers, bounce the ball around for a full minute. The ball should never escape the table boundaries. If it does, it should bounce off the invisible world edge and re-enter play.

4. **Speed feel** — The ball should still feel fast and snappy. Bumper bounces should be energetic. The lower cap (200 vs 300) should not noticeably dull gameplay.

5. **Layout** — Resize the browser window from mobile-width (~320px) to desktop (~1400px). The HUD should scale smoothly, elements should never overlap, and the game canvas should always be centered vertically and horizontally.

6. **Regression** — Verify: bumper scoring (popups + sounds), 3 lives with drain/respawn, game over flow, touch controls (if available), flipper mechanics, launch charging bar.

- [ ] **Step 3: Fix any issues found during verification**

If verification reveals problems, diagnose and fix before proceeding.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git status
# Review changes, then commit if any fixes were made
```
