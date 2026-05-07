# Flipper Physics Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tween-plus-manual-sync flippers with a piston constraint system for accurate hitboxes and realistic ball reaction, and add slight bounce to all table surfaces.

**Architecture:** Each flipper becomes a dynamic Matter.js body driven by a pin constraint (hinge) and piston constraint (actuator). Sprite created via `matter.add.sprite()` for automatic body-sync. Tween the piston constraint's `length` property to drive flipper motion. All changes in `GameScene.js`.

**Tech Stack:** Phaser 3, Matter.js (via Phaser's Matter physics plugin), Vite dev server.

---

### Task 1: Add slight bounce to table walls

**Files:**
- Modify: `src/scenes/GameScene.js:87-122` (buildTable())

- [ ] **Step 1: Add `restitution: 0.3` to all wall bodies in `buildTable()`**

Replace the entire `buildTable()` method:

```javascript
  buildTable() {
    const wallOpts = { isStatic: true, restitution: 0.3 };
    this.matter.add.rectangle(8, 525, 16, 1050, wallOpts);         // left
    this.matter.add.rectangle(692, 525, 16, 1050, wallOpts);      // right
    this.matter.add.rectangle(350, 8, 700, 16, wallOpts);         // top
    this.matter.add.rectangle(155, 1016, 278, 16, wallOpts);     // bottom left
    this.matter.add.rectangle(513, 1016, 342, 16, wallOpts);     // bottom right
    this.matter.add.rectangle(620, 768, 16, 512, wallOpts);      // launch lane divider
    this.matter.add.rectangle(660, 1020, 52, 16, wallOpts);     // launch lane bottom stop

    // Funnel guides
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    this.matter.add.rectangle(155, 858, 421, 16, { ...wallOpts, angle: leftAngle });

    const rightAngle = Phaser.Math.Angle.Between(620, 700, 342, 1016);
    this.matter.add.rectangle(481, 858, 421, 16, { ...wallOpts, angle: rightAngle });

    // Visual representation of funnel lines (rendering only)
    const funnelGfx = this.add.graphics();
    funnelGfx.lineStyle(4, 0x3a3a6a, 1);
    funnelGfx.lineBetween(16, 700, 294, 1016);
    funnelGfx.lineBetween(620, 700, 342, 1016);

    // Wall visuals — 8px stroke outlines
    const wallGfx = this.add.graphics();
    wallGfx.lineStyle(8, 0x5a5a8a, 1);
    wallGfx.strokeRect(0, 0, 16, 1050);
    wallGfx.strokeRect(684, 0, 16, 1050);
    wallGfx.strokeRect(0, 0, 700, 16);
    wallGfx.strokeRect(16, 1008, 278, 16);
    wallGfx.strokeRect(342, 1008, 342, 16);
    wallGfx.strokeRect(612, 512, 16, 512);
    wallGfx.strokeRect(634, 1012, 52, 16);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
fix: add slight bounce (restitution 0.3) to all table walls

Makes ball deflections feel natural instead of dead. Shared
wallOpts object keeps all wall bodies consistent.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Replace flipper physics with piston constraints

**Files:**
- Modify: `src/scenes/GameScene.js:170-208` (buildFlippers())

- [ ] **Step 1: Replace `buildFlippers()` with piston constraint system**

Replace the entire `buildFlippers()` method (lines 170-208):

```javascript
  buildFlippers() {
    const Matter = Phaser.Physics.Matter.Matter;

    // ---- Left flipper ----

    // Static pivot body — invisible anchor at pivot point
    this.leftPivotBody = this.matter.add.rectangle(121.6, 820, 10, 10, {
      isStatic: true
    });
    this.leftPivotBody.scaleX = 0.02;
    this.leftPivotBody.scaleY = 0.02;

    // Flipper sprite with physics body — auto-synced by Phaser
    this.leftFlipper = this.matter.add.sprite(199.8, 820, 'flipper', null, {
      restitution: 0.2,
      friction: 0.4,
      frictionAir: 0.01,
      density: 0.01,
      isSleepingAllowed: false
    })
      .setOrigin(0.5, 0.5)
      .setDepth(2);
    Matter.Body.setAngle(this.leftFlipper.body, Phaser.Math.DegToRad(20));

    // Pin constraint — hinge at left edge of flipper
    this.leftPinConstraint = this.matter.add.constraint(
      this.leftPivotBody, this.leftFlipper.body, {
        length: 0,
        stiffness: 0.9
      }
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
      this.leftBlockBody, this.leftFlipper.body, {
        stiffness: 1.0
      }
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

    // Flipper sprite with physics body
    this.rightFlipper = this.matter.add.sprite(436.2, 820, 'flipper', null, {
      restitution: 0.2,
      friction: 0.4,
      frictionAir: 0.01,
      density: 0.01,
      isSleepingAllowed: false
    })
      .setOrigin(0.5, 0.5)
      .setDepth(2);
    Matter.Body.setAngle(this.rightFlipper.body, Phaser.Math.DegToRad(-20));

    // Pin constraint — hinge at right edge of flipper
    this.rightPinConstraint = this.matter.add.constraint(
      this.rightPivotBody, this.rightFlipper.body, {
        length: 0,
        stiffness: 0.9
      }
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
      this.rightBlockBody, this.rightFlipper.body, {
        stiffness: 1.0
      }
    );
    this.rightPistonConstraint.length = 75.7;
    this.rightPistonConstraint.pointB = { x: 25, y: -47 };


    // Piston lengths for rest and active positions
    this.pistonRestLength = 75.7;
    this.pistonActiveLength = 61.3;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
fix: replace flipper build with piston constraint system

Create pivot bodies, flipper sprites via matter.add.sprite for
auto body-sync, block bodies, pin constraints (hinge), and piston
constraints (actuator). Physics-driven flippers eliminate manual
setPosition/setAngle teleports that caused explosive ball velocity.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add flipper actuation methods

**Files:**
- Modify: `src/scenes/GameScene.js` (add methods after `buildFlippers()`)

- [ ] **Step 1: Add four flipper methods after `buildFlippers()` and before `buildUI()`**

Insert the following four methods between `buildFlippers()` and `buildUI()`:

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

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
feat: add flipper actuation methods that tween piston constraints

flipLeft/Right tween piston length to active position (60ms).
releaseLeft/Right tween back to rest (120ms). Physics engine
computes flipper velocity naturally from constraint forces.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update input handlers to use new flipper methods

**Files:**
- Modify: `src/scenes/GameScene.js:222-335` (setupInput())

- [ ] **Step 1: Replace inline flipper tween handlers with method calls**

In `setupInput()`, replace the flipper handler definitions (lines 248-284) with:

```javascript
    const onLeftFlipperDown = () => this.flipLeft();
    const onLeftFlipperUp = () => this.releaseLeft();

    const onRightFlipperDown = () => this.flipRight();
    const onRightFlipperUp = () => this.releaseRight();
```

The binding lines (lines 286-294) and touch control setup (lines 297-334) remain unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
refactor: simplify input handlers to call flipper actuation methods

Replace inline tween-based flipper handlers with calls to
flipLeft/Right and releaseLeft/Right methods. Reduces duplication
and centralizes flipper actuation logic.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Remove flipper sync from `update()`

**Files:**
- Modify: `src/scenes/GameScene.js:414-496` (update())

- [ ] **Step 1: Delete the flipper setPosition/setAngle sync block**

Remove the following block from `update()` (currently lines 447-461):

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

Delete this entire block. The physics engine now handles all flipper positioning through the constraint system, and the sprite auto-syncs via `matter.add.sprite()`.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "$(cat <<'EOF'
refactor: remove manual flipper sync from update loop

Flipper positioning is now handled entirely by the physics engine
through pin and piston constraints. Sprite syncs automatically via
matter.add.sprite coupling. Eliminates the root cause of explosive
ball velocity on flipper contact.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verify in browser

**Files:** none — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser and verify**

Navigate to `http://localhost:5173` (or the port Vite reports) and test each item:

1. **Flipper appears at correct position** — Flippers should render at the same visual positions as before. If they're missing or offset, check sprite origin and body position alignment.

2. **Flipper responds to input** — Press A/Left and D/Right keys. Flippers should swing upward and return to rest. Check for console errors about constraint issues.

3. **Hitbox accuracy** — Roll the ball near the flippers without visually touching them. The ball should NOT react. It should only respond when visually contacting a flipper.

4. **Stationary flipper** — Drop a ball onto a flipper at rest. Ball should bounce slightly then slide/roll off. No rocket effect.

5. **Active flipper** — Time a flipper press to hit the ball. Ball should receive upward momentum. Should feel responsive but not explosive.

6. **Wall bounce** — Ball should deflect off walls with slight bounce, not dead stop.

7. **Regression** — Bumper scoring (popups + sound), lives (3 lives, drain -> respawn), game over flow, launch mechanics (hold Space to charge, release to fire), touch controls all still work.

- [ ] **Step 3: Fix any issues found during verification**

If verification reveals problems, diagnose and fix before proceeding. Common issues:
- Flippers not visible: Check that `matter.add.sprite` texture key 'flipper' resolves correctly
- Flippers oscillating wildly: Lower piston stiffness or add damping
- Flippers not reaching target angle: Adjust piston active length (try values between 55-65)
- Ball still rockets off flippers: Check that the old `leftFlipperBody`/`rightFlipperBody` references are fully removed

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git status
# Review changes, then commit if any fixes were made
```
