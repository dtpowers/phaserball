# Physics Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three physics bugs: invisible launch closure wall, inaccurate flipper hitbox, and unrealistic flipper ball reaction.

**Architecture:** All changes in `GameScene.js`. Add a Graphics line for the launch closure wall. Replace flipper physics with a piston-constraint system (static pivot body + dynamic flipper body + pin constraint + piston constraint per flipper). Tween piston constraint `length` to drive flipper motion. Remove manual flipper sync from `update()`.

**Tech Stack:** Phaser 3, Matter.js (via Phaser's Matter physics plugin), Vite dev server.

---

### Task 1: Launch closure wall visual

**Files:**
- Modify: `src/scenes/GameScene.js:18-27` (create() — add state variable)
- Modify: `src/scenes/GameScene.js:471-478` (update() — draw wall visual on creation)
- Modify: `src/scenes/GameScene.js:394-399` (spawnBall() — destroy wall visual on reset)

- [ ] **Step 1: Add `launchClosureGfx` state in `create()`**

In `create()`, after `this.launchClosureActive = false;` (line 27), add:

```javascript
    this.launchClosureGfx = null;
```

- [ ] **Step 2: Draw wall visual when closure body is created in `update()`**

Replace the launch lane closure block (lines 471-478):

```javascript
    // Launch lane closure — seal the lane when ball exits upward
    if (this.ball && !this.launchClosureActive && this.ball.x > 620 && this.ball.y < 520 && this.ball.body.velocity.y < 0) {
      this.launchClosureBody = this.matter.add.rectangle(656, 510, 75, 16, {
        isStatic: true,
        angle: Phaser.Math.DegToRad(-15.5)
      });
      this.launchClosureActive = true;

      // Visual representation of the closure wall
      this.launchClosureGfx = this.add.graphics();
      this.launchClosureGfx.lineStyle(4, 0x3a3a6a, 1);
      this.launchClosureGfx.lineBetween(620, 520, 692, 500);
    }
```

- [ ] **Step 3: Destroy wall visual when resetting in `spawnBall()`**

In `spawnBall()`, after the launch closure body removal block (lines 394-399), add:

```javascript
    // Reset launch lane closure visual
    if (this.launchClosureGfx) {
      this.launchClosureGfx.destroy();
      this.launchClosureGfx = null;
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: add visual representation for launch lane closure wall

Draws a 4px line (color 0x3a3a6a) matching the physics body when
the wall is created. Destroyed on ball respawn."
```

---

### Task 2: Replace flipper physics with piston constraints

**Files:**
- Modify: `src/scenes/GameScene.js:165-203` (buildFlippers())
- Modify: `src/scenes/GameScene.js:217-329` (setupInput())
- Modify: `src/scenes/GameScene.js:434-449` (update() — remove flipper sync)

- [ ] **Step 1: Replace `buildFlippers()` with piston constraint system**

Replace the entire `buildFlippers()` method (lines 165-203):

```javascript
  buildFlippers() {
    // ---- Left flipper ----

    // Static pivot body — invisible anchor at pivot point
    this.leftPivotBody = this.matter.add.rectangle(121.6, 820, 10, 10, {
      isStatic: true
    });
    this.leftPivotBody.scaleX = 0.02;
    this.leftPivotBody.scaleY = 0.02;

    // Sprite with physics body — tracked by Phaser for automatic position/angle sync
    this.leftFlipper = this.matter.add.sprite(199.6, 820, 'flipper', null, {
      restitution: 0.0,
      friction: 0.4,
      isSleepingAllowed: false
    })
      .setOrigin(0.5, 0.5)
      .setDepth(2);
    this.leftFlipper.body.restitution = 0.0;
    this.leftFlipper.body.friction = 0.4;
    Matter.Body.setAngle(this.leftFlipper.body, Phaser.Math.DegToRad(20));

    // Pin constraint — locks left edge of flipper to pivot (rotation axis)
    this.leftPinConstraint = this.matter.add.constraint(
      this.leftPivotBody, this.leftFlipper.body, { stiffness: 0.9 }
    );
    this.leftPinConstraint.pointB = { x: -78, y: 0 };

    // Static block body — invisible piston anchor, 80px above pivot
    this.leftBlockBody = this.matter.add.rectangle(121.6, 740, 10, 10, {
      isStatic: true
    });
    this.leftBlockBody.scaleX = 0.02;
    this.leftBlockBody.scaleY = 0.02;

    // Piston constraint — tweening length drives flipper rotation
    this.leftPistonConstraint = this.matter.add.constraint(
      this.leftBlockBody, this.leftFlipper.body, { stiffness: 1.0 }
    );
    this.leftPistonConstraint.length = 75.7;
    this.leftPistonConstraint.pointB = { x: -25, y: -47 };


    // ---- Right flipper ----

    // Static pivot body
    this.rightPivotBody = this.matter.add.rectangle(514.4, 820, 10, 10, {
      isStatic: true
    });
    this.rightPivotBody.scaleX = 0.02;
    this.rightPivotBody.scaleY = 0.02;

    // Sprite with physics body
    this.rightFlipper = this.matter.add.sprite(436.4, 820, 'flipper', null, {
      restitution: 0.0,
      friction: 0.4,
      isSleepingAllowed: false
    })
      .setOrigin(0.5, 0.5)
      .setDepth(2);
    this.rightFlipper.body.restitution = 0.0;
    this.rightFlipper.body.friction = 0.4;
    Matter.Body.setAngle(this.rightFlipper.body, Phaser.Math.DegToRad(-20));

    // Pin constraint — locks right edge of flipper to pivot
    this.rightPinConstraint = this.matter.add.constraint(
      this.rightPivotBody, this.rightFlipper.body, { stiffness: 0.9 }
    );
    this.rightPinConstraint.pointB = { x: 78, y: 0 };

    // Static block body
    this.rightBlockBody = this.matter.add.rectangle(514.4, 740, 10, 10, {
      isStatic: true
    });
    this.rightBlockBody.scaleX = 0.02;
    this.rightBlockBody.scaleY = 0.02;

    // Piston constraint
    this.rightPistonConstraint = this.matter.add.constraint(
      this.rightBlockBody, this.rightFlipper.body, { stiffness: 1.0 }
    );
    this.rightPistonConstraint.length = 75.7;
    this.rightPistonConstraint.pointB = { x: 25, y: -47 };


    // Piston lengths for rest and active positions
    this.pistonRestLength = 75.7;
    this.pistonActiveLength = 61.3;
  }
```

- [ ] **Step 2: Add `flipLeft()`, `releaseLeft()`, `flipRight()`, `releaseRight()` methods**

Add these four methods after `buildFlippers()` and before `buildUI()`:

```javascript
  flipLeft() {
    this.tweens.add({
      targets: this.leftPistonConstraint,
      length: this.pistonActiveLength,
      duration: 60,
      ease: 'Sine.easeOut'
    });
    this.sound.play('flipper-activate');
  }

  releaseLeft() {
    this.tweens.add({
      targets: this.leftPistonConstraint,
      length: this.pistonRestLength,
      duration: 120,
      ease: 'Sine.easeOut'
    });
  }

  flipRight() {
    this.tweens.add({
      targets: this.rightPistonConstraint,
      length: this.pistonActiveLength,
      duration: 60,
      ease: 'Sine.easeOut'
    });
    this.sound.play('flipper-activate');
  }

  releaseRight() {
    this.tweens.add({
      targets: this.rightPistonConstraint,
      length: this.pistonRestLength,
      duration: 120,
      ease: 'Sine.easeOut'
    });
  }
```

- [ ] **Step 3: Update `setupInput()` to use new flip methods**

In `setupInput()` (lines 217-329), replace all the inline tween-based flipper handlers with calls to the new methods.

Replace lines 243-279:

```javascript
    const onLeftFlipperDown = () => this.flipLeft();
    const onLeftFlipperUp = () => this.releaseLeft();

    const onRightFlipperDown = () => this.flipRight();
    const onRightFlipperUp = () => this.releaseRight();
```

- [ ] **Step 4: Remove flipper sync from `update()`**

Delete lines 434-449 (the flipper sync block):

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

Remove this entire block. The physics engine now handles all flipper positioning through the constraint system.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "fix: replace flipper physics with piston constraint system

Replace setPosition/setAngle sync with piston constraints that
naturally drive flipper rotation. Stationary flippers behave like
walls (restitution 0.0), moving flippers transfer momentum
proportional to swing velocity. Removes manual flipper sync from
update() loop."
```

---

### Task 3: Verify all changes in browser

**Files:** none — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser and verify each change**

Navigate to `http://localhost:5173` (or the port Vite reports) and test:

1. **Launch wall visual** — Launch the ball. After it exits the launch lane, a neon line should appear connecting `(620, 520)` to `(692, 500)`. The line should disappear when the ball drains and respawns.

2. **Flipper hitbox accuracy** — Roll the ball near the flippers without visually touching them. The ball should NOT rocket away. It should only react when visually contacting a flipper.

3. **Stationary flipper behavior** — Drop a ball onto a flipper at rest. The ball should slide off slowly, like rolling off a wall. No violent bounce.

4. **Active flipper behavior** — Time a flipper press to hit the ball. The ball should receive upward momentum proportional to the flipper swing speed. Should feel responsive but not explosive.

5. **Flipper visual match** — The flipper sprites should perfectly align with their physics bodies at all angles. No visible offset between what you see and where the ball collides.

6. **Flipper-to-funnel gap** — Ball should not slip between the outer edge of either flipper and the funnel wall.

7. **Regression** — Bumper scoring (with popups and sounds), lives (3 lives, drain → respawn), game over flow, launch mechanics (hold Space to charge, release to fire), touch controls all still work.

- [ ] **Step 3: Fix any issues found during verification**

If verification reveals problems, diagnose and fix before proceeding.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git status
# Review changes, then commit if any fixes were made
```
