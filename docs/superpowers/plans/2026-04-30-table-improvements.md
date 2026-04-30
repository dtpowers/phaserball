# Table Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three table geometry and UI issues: sparse ceiling, always-visible power meter, and inverted funnel direction.

**Architecture:** Three targeted edits in `src/scenes/GameScene.js` — replace the ceiling loop with the existing `buildHorizontalWall` helper, toggle power bar visibility in `update()`, and swap funnel diagonal endpoints.

**Tech Stack:** Phaser 3, Arcade physics, Vite dev server

---

### Task 1: Replace Ceiling with Horizontal Wall

**Files:**
- Modify: `src/scenes/GameScene.js:69`

- [ ] **Step 1: Replace the top wall loop with `buildHorizontalWall`**

Replace line 69:
```js
for (let x = 16; x < 684; x += 32) walls.create(x, 16, 'wall');
```

With:
```js
this.buildHorizontalWall(walls, 16, 684, 16);
```

- [ ] **Step 2: Verify in dev server**

Run: `npm run dev`
Navigate to `http://localhost:5173`
Expected: The ceiling is now a solid horizontal wall with no visible gaps between tiles.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: replace sparse ceiling with horizontal wall using buildHorizontalWall helper"
```

---

### Task 2: Hide Power Meter When Not Charging

**Files:**
- Modify: `src/scenes/GameScene.js:386-408`

- [ ] **Step 1: Add visibility toggle to the `update()` method**

In the charging branch (line 388), add `setVisible(true)` calls before existing logic:
```js
if (!this.ballLaunched && this.isCharging) {
  this.powerBarBg.setVisible(true);
  this.powerBarFill.setVisible(true);
```

In the else branch (line 404), add `setVisible(false)` calls:
```js
} else {
  this.powerBarBg.setVisible(false);
  this.powerBarFill.setVisible(false);
```

- [ ] **Step 2: Verify in dev server**

Run: `npm run dev`
Navigate to `http://localhost:5173`
Expected: The power bar is hidden on game start. It becomes visible only while holding Space to charge the launch, and hides again after the ball is launched.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: hide power meter when ball is not being charged"
```

---

### Task 3: Invert Funnel Diagonals Toward the Drain

**Files:**
- Modify: `src/scenes/GameScene.js:80-82`

- [ ] **Step 1: Swap funnel diagonal endpoints**

Replace lines 80-82:
```js
this.buildDiagonalWall(walls, 16, 1016, 250, 700);
this.buildDiagonalWall(walls, 684, 1016, 450, 700);
```

With:
```js
this.buildDiagonalWall(walls, 16, 700, 275, 1016);
this.buildDiagonalWall(walls, 684, 700, 425, 1016);
```

This swaps start/end so the left funnel slopes from (16,700) down to (275,1016) and the right slopes from (684,700) down to (425,1016), guiding the ball toward the drain gap (x=275 to x=425).

- [ ] **Step 2: Verify in dev server**

Run: `npm run dev`
Navigate to `http://localhost:5173`
Expected: The funnel walls slope downward toward center, guiding the ball into the drain. The ball should fall through the drain gap (x=275 to x=425) when it enters the funnel area.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: invert funnel diagonals to guide ball toward drain"
```

