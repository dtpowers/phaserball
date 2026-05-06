# Physics Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune launch pacing, replace static flipper bodies with dynamic constraint-pivoted bodies, widen flippers to touch funnel, add launch lane closure wall, and thicken funnel collision bodies.

**Architecture:** Two files changed — `BootScene.js` (flipper texture width) and `GameScene.js` (all physics/geometry). Flippers switch from `isStatic: true` bodies to dynamic bodies anchored by `Matter.worldConstraint` pivots, still driven by Phaser tweens each frame.

**Tech Stack:** Phaser 3, Matter.js (via Phaser's Matter physics plugin), Vite dev server.

---

### Task 1: Launch parameter tweaks (items 1, 2)

**Files:**
- Modify: `src/scenes/GameScene.js:5-11`

- [ ] **Step 1: Update LAUNCH config constants**

Replace the `LAUNCH` object at lines 5-11:

```javascript
const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.6,
  baseVel:    5,
  velScale:   0.00625,
  xVel:       -10
};
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: increase launch charge rate 20% and velocity scale 25%"
```

### Task 2: Flipper texture width (item 4)

**Files:**
- Modify: `src/scenes/BootScene.js:79-85`

- [ ] **Step 1: Widen flipper texture from 120 to 156**

Replace lines 79-85:

```javascript
    // Flipper — rounded rectangle, neon blue
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    g.fillRoundedRect(0, 0, 156, 28, 14);
    g.strokeRoundedRect(0, 0, 156, 28, 14);
    g.generateTexture('flipper', 156, 28);
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/BootScene.js
git commit -m "fix: widen flipper texture 120x28 to 156x28 to reach funnel walls"
```

### Task 3: Flipper physics overhaul + positioning (items 3, 7)

**Files:**
- Modify: `src/scenes/GameScene.js` — `buildFlippers()`, `setupInput()` (positions), `update()` (sync logic)

- [ ] **Step 1: Replace `buildFlippers()` with constraint-pivoted dynamic bodies**

Replace the entire `buildFlippers()` method (lines 163-193):

```javascript
  buildFlippers() {
    // Left flipper — pivot at left edge (x=121.6), extends rightward
    this.leftFlipper = this.add.image(121.6, 820, 'flipper');
    this.leftFlipper.setOrigin(0, 0.5);
    this.leftFlipper.setAngle(20);

    // Dynamic physics body for left flipper — pinned by constraint at pivot
    this.leftFlipperBody = this.matter.add.rectangle(199.8, 820, 156, 28, {
      restitution: 1.0,
      friction: 0.05
    });

    // Constraint pins left end of the body (offset -78px from center)
    this.leftFlipperConstraint = this.matter.add.worldConstraint(
      this.leftFlipperBody, 0, 0.9,
      { pointA: { x: 121.6, y: 820 }, pointB: { x: -78, y: 0 } }
    );

    // Right flipper — pivot at right edge (x=514.4), extends leftward
    this.rightFlipper = this.add.image(514.4, 820, 'flipper');
    this.rightFlipper.setOrigin(1, 0.5);
    this.rightFlipper.setAngle(-20);

    // Dynamic physics body for right flipper — pinned by constraint at pivot
    this.rightFlipperBody = this.matter.add.rectangle(436.2, 820, 156, 28, {
      restitution: 1.0,
      friction: 0.05
    });

    // Constraint pins right end of the body (offset +78px from center)
    this.rightFlipperConstraint = this.matter.add.worldConstraint(
      this.rightFlipperBody, 0, 0.9,
      { pointA: { x: 514.4, y: 820 }, pointB: { x: 78, y: 0 } }
    );

    // Flipper rest and active angles — swing upward
    this.flipperRestAngle = { left: 20, right: -20 };
    this.flipperActiveAngle = { left: -30, right: 30 };
  }
```

- [ ] **Step 2: Update `update()` flipper sync logic**

Replace the flipper sync block (lines 417-432) with sync that positions the dynamic bodies to match the tweened visuals:

```javascript
    // Sync flipper physics bodies to visual position and angle
    if (this.leftFlipper && this.leftFlipperBody) {
      Matter.Body.setPosition(this.leftFlipperBody, {
        x: this.leftFlipper.x + 78,
        y: this.leftFlipper.y
      });
      Matter.Body.setAngle(this.leftFlipperBody, Phaser.Math.DegToRad(this.leftFlipper.angle));
    }

    if (this.rightFlipper && this.rightFlipperBody) {
      Matter.Body.setPosition(this.rightFlipperBody, {
        x: this.rightFlipper.x - 78,
        y: this.rightFlipper.y
      });
      Matter.Body.setAngle(this.rightFlipperBody, Phaser.Math.DegToRad(this.rightFlipper.angle));
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: replace static flipper bodies with dynamic constraint-pivoted bodies

Dynamic bodies transfer real momentum to the ball on impact. Flippers
moved outward (pivots at x=121.6 and x=514.4) so outer edges touch
funnel walls. Body width matches 156px texture."
```

### Task 4: Funnel collision body thickness (item 6)

**Files:**
- Modify: `src/scenes/GameScene.js:92-97`

- [ ] **Step 1: Increase funnel body thickness from 8px to 16px**

Replace lines 92-97:

```javascript
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    this.matter.add.rectangle(155, 858, 421, 16, { isStatic: true, angle: leftAngle });

    // Right funnel: (620,700) -> (342,1016)
    const rightAngle = Phaser.Math.Angle.Between(620, 700, 342, 1016);
    this.matter.add.rectangle(481, 858, 421, 16, { isStatic: true, angle: rightAngle });
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: increase funnel collision body thickness 8px to 16px

Prevents ball clipping through thin collision surfaces at high velocity."
```

### Task 5: Launch lane closure wall (item 5)

**Files:**
- Modify: `src/scenes/GameScene.js` — `create()`, `spawnBall()`, `update()`

- [ ] **Step 1: Add `launchClosureBody` state in `create()`**

After line 25 (`this.isLosingLife = false;`), add:

```javascript
    this.launchClosureBody = null;
    this.launchClosureActive = false;
```

- [ ] **Step 2: Add launch closure trigger in `update()`**

In the `update()` method, after the relaunch detection block (lines 447-452), add logic that creates the closure wall when the ball exits the launch lane upward:

```javascript
    // Launch lane closure — seal the lane when ball exits upward
    if (this.ball && !this.launchClosureActive && this.ball.x > 620 && this.ball.y < 520 && this.ball.body.velocity.y < 0) {
      this.launchClosureBody = this.matter.add.rectangle(656, 510, 75, 16, {
        isStatic: true,
        angle: Phaser.Math.DegToRad(-15.5)
      });
      this.launchClosureActive = true;
    }
```

- [ ] **Step 3: Reset closure in `spawnBall()`**

In `spawnBall()`, after `this.isCharging = false;` (line 382), add:

```javascript
    // Reset launch lane closure
    if (this.launchClosureBody) {
      this.matter.world.remove(this.launchClosureBody);
      this.launchClosureBody = null;
    }
    this.launchClosureActive = false;
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: add slanted launch lane closure wall when ball exits

Wall connects launch lane divider (620,520) to right wall (692,500),
slanting upward so balls roll off. Created once per ball, reset on spawn."
```

### Task 6: Verify all changes in browser

**Files:** none — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser and verify each change**

Navigate to `http://localhost:5173` and test:

1. **Launch charge rate** — Hold Space until power bar is full. Should charge noticeably faster (~5.6s vs previous ~6.7s).
2. **Launch velocity** — Max power launch should clear the launch lane in one shot without needing a secondary launch.
3. **Flipper physics** — Hit the ball with a flipper. Ball should receive strong upward momentum, not just a weak bounce. Try rapid successive hits.
4. **Flipper visual match** — Physics body should align with the flipper sprite. No visible offset between what you see and where the ball collides.
5. **Flipper-to-funnel gap** — Ball should not slip between the outer edge of either flipper and the funnel wall.
6. **Launch lane closure** — After the ball exits the launch lane, verify it cannot fall back in. The slanted wall should be visible connecting the lane divider to the right wall.
7. **Funnel collision** — Ball should bounce off or roll down the funnel. Drop the ball through the bumper field multiple times to verify no clipping through the funnel bodies.
8. **Regression** — Bumper scoring, lives (3 lives, drain → respawn), game over flow, touch controls all still work.

- [ ] **Step 3: Fix any issues found during verification**

If verification reveals problems, diagnose and fix before proceeding.

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
# Review changes, then commit if all looks good
```
