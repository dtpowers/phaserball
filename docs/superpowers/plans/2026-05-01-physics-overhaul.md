# Physics Overhaul — Arcade to Matter.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from Arcade physics to Matter.js, replacing tile-based walls with uniform static rectangles, manual funnel collision with rotated static bodies, and fixing re-launch logic — all while improving ball bounce feel.

**Architecture:** Matter.js provides rotated static bodies (funnel walls), restitution-based bounce (bumpers), and automatic body-body collision. Flippers remain manual distance-based collision in `update()` since tween rotation + physics body tracking is unreliable. Re-launch uses unconditional launch-lane detection instead of a one-time flag.

**Tech Stack:** Phaser 4, Matter.js physics, `this.matter.add.*` API.

---

### Task 1: Migrate physics config from Arcade to Matter.js

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Replace the physics config in `src/main.js`**

Replace the `physics` block:

```js
  physics: {
    default: 'matter',
    matter: {
      gravity: {
        y: 1
      },
      enableSleeping: false,
      setBounds: false
    }
  },
```

- [ ] **Step 2: Verify — dev server starts without errors**

Run: `npm run dev`

Expected: No console errors. Game loads. No physics visible yet (GameScene still references `this.physics` which will break — this is expected, we fix in next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: migrate physics engine from Arcade to Matter.js

- Change default physics to 'matter' with gravity y=1
- Disable sleeping for responsive ball, disable auto bounds
- GameScene not yet updated — will break until next tasks"
```

---

### Task 2: Replace tile-based walls with uniform static rectangles

**Files:**
- Modify: `src/scenes/GameScene.js:63-94` (entire `buildTable` method)

- [ ] **Step 1: Rewrite `buildTable()` to use Matter static rectangles**

Replace the entire `buildTable()` method:

```js
buildTable() {
  // Uniform static wall rectangles — all 16px thick
  this.matter.add.rectangle(8, 525, 16, 1050, { isStatic: true });       // left
  this.matter.add.rectangle(692, 525, 16, 1050, { isStatic: true });    // right
  this.matter.add.rectangle(350, 8, 700, 16, { isStatic: true });       // top
  this.matter.add.rectangle(145, 1016, 260, 16, { isStatic: true });    // bottom left (drain gap x=275..425)
  this.matter.add.rectangle(555, 1016, 260, 16, { isStatic: true });    // bottom right
  this.matter.add.rectangle(620, 768, 16, 512, { isStatic: true });     // launch lane divider (y=512..1024)

  // Funnel — rotated static rectangles at midpoint of each diagonal
  // Left funnel: (16,700) → (275,1016), length ~340px
  const leftAngle = Phaser.Math.Angle.Between(16, 700, 275, 1016);
  this.matter.add.rectangle(145, 858, 340, 8, { isStatic: true, angle: leftAngle });

  // Right funnel: (620,700) → (425,1016), length ~340px
  const rightAngle = Phaser.Math.Angle.Between(620, 700, 425, 1016);
  this.matter.add.rectangle(522, 858, 340, 8, { isStatic: true, angle: rightAngle });

  // Visual representation of funnel lines (rendering only)
  const funnelGfx = this.add.graphics();
  funnelGfx.lineStyle(4, 0x3a3a6a, 1);
  funnelGfx.lineBetween(16, 700, 275, 1016);
  funnelGfx.lineBetween(620, 700, 425, 1016);
}
```

- [ ] **Step 2: Remove `buildHorizontalWall()` helper — no longer needed**

Delete the entire `buildHorizontalWall` method:

```js
// REMOVE this method entirely:
buildHorizontalWall(walls, xStart, xEnd, y) {
  for (let x = xStart; x < xEnd; x += 4) {
    walls.create(x, y, 'wall');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: replace tile-based walls with uniform Matter static rectangles

- All walls now 16px thick (uniform ceiling, floor, sides)
- Funnel walls are rotated static rectangles using Matter.js
- Removed buildHorizontalWall helper
- Visual funnel lines preserved via graphics rendering"
```

---

### Task 3: Replace bumper static group with static circles and collisionstart event

**Files:**
- Modify: `src/scenes/GameScene.js:97-151` (entire `buildBumpers` method)

- [ ] **Step 1: Rewrite `buildBumpers()` with Matter static circles**

Replace the entire `buildBumpers()` method:

```js
buildBumpers() {
  const bumperDefs = [
    { x: 312, y: 80,  points: 250, type: 'flower', key: 'bumper-flower' },
    { x: 180, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
    { x: 340, y: 140, points: 100, type: 'star',   key: 'bumper-star' },
    { x: 500, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
    { x: 260, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
    { x: 420, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
    { x: 200, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
    { x: 340, y: 330, points: 200, type: 'moon',   key: 'bumper-moon' },
    { x: 480, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
  ];

  this.bumperBodies = new Map();

  bumperDefs.forEach(def => {
    // Visual bumper sprite (no physics)
    const bumper = this.add.image(def.x, def.y, def.key);

    // Physics body — static circle with high restitution for energetic bounce
    const body = this.matter.add.circle(def.x, def.y, 28, {
      isStatic: true,
      restitution: 1.2
    });
    // Store bumper data on the body for collision callback lookup
    body.bumperData = { points: def.points, type: def.type, sprite: bumper };
    this.bumperBodies.set(body.id, body);

    // Glow overlay
    const glow = this.add.circle(
      def.x, def.y, 48, 0xffffff, 0.05
    ).setDepth(bumper.depth - 1);

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
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: replace bumper static group with Matter static circles

- Each bumper is a static circle with restitution 1.2 for energetic bounce
- Bumper visuals are plain images (no physics body needed on sprite)
- Bumper data (points, type, sprite ref) stored on body.bumperData for collision lookup
- bumperBodies is a Map keyed by body.id for O(1) collision detection"
```

---

### Task 4: Replace ball group with Matter circle body and tuned properties

**Files:**
- Modify: `src/scenes/GameScene.js:363-375` (`spawnBall` method)

- [ ] **Step 1: Rewrite `spawnBall()` for Matter.js**

Replace the entire `spawnBall()` method:

```js
spawnBall() {
  this.isLosingLife = false;

  this.ball = this.matter.add.image(652, 950, 'ball', null, {
    restitution: 0.8,
    friction: 0,
    frictionAir: 0.0001,
    density: 0.001,
    shape: { type: 'circle', radius: 16 }
  });

  this.ballLaunched = false;
  this.launchPower = 0;
  this.isCharging = false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: replace Arcade ball group with Matter circle body

- Tuned physics: restitution 0.8, zero friction, minimal air drag
- Ball spawns at (652, 950) in launch lane
- Removed ballGroup, setCollideWorldBounds, setBounce, setCircle"
```

---

### Task 5: Replace collider setup with Matter collisionstart event

**Files:**
- Modify: `src/scenes/GameScene.js:324-361` (`setupCollisions` method)

- [ ] **Step 1: Replace `setupCollisions()` with Matter collision event**

Replace the entire `setupCollisions()` method:

```js
setupCollisions() {
  this.matter.world.on('collisionstart', (event) => {
    event.pairs.forEach(pair => {
      // Check if either body is a bumper body
      const bumperBody = this.bumperBodies.has(pair.bodyA.id)
        ? pair.bodyA
        : this.bumperBodies.has(pair.bodyB.id)
          ? pair.bodyB
          : null;

      if (!bumperBody || !bumperBody.bumperData) return;

      const { points, sprite: bumperSprite } = bumperBody.bumperData;

      this.score += points;
      this.updateScoreDisplay();

      // Visual feedback — brief scale pulse
      this.tweens.add({
        targets: bumperSprite,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });

      // Audio feedback
      this.sound.play('bumper-hit');

      // Score popup
      const popup = this.add.text(bumperSprite.x, bumperSprite.y - 40, `+${points}`, {
        fontSize: '28px', color: '#ffffff', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);

      this.tweens.add({
        targets: popup,
        y: bumperSprite.y - 100,
        alpha: 0,
        duration: 800,
        onComplete: () => popup.destroy()
      });
    });
  });
}
```

- [ ] **Step 2: Verify — bumper collision still triggers scoring and visual feedback**

Run: `npm run dev`

Expected: When the ball hits a bumper, the score increases, the bumper pulses, sound plays, and a score popup animates upward. (Note: you need a ball in play — verify after Task 6 when launch works.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: replace Arcade collider with Matter collisionstart event

- Uses Matter.js collisionstart event to detect bumper hits
- Finds matching bumper sprite by position for scoring data
- Same visual/audio feedback as before"
```

---

### Task 6: Update launch input for Matter.js velocity API

**Files:**
- Modify: `src/scenes/GameScene.js:207-322` (`setupInput` method)

- [ ] **Step 1: Update SPACE key handlers for Matter.js velocity API**

In the `this.keys.SPACE.on('down', ...)` handler, replace:

```js
      if (!this.ballLaunched) {
        this.isCharging = true;
        this.ball.setVelocity(0, 0);
        this.ball.body.allowGravity = false;
      }
```

With:

```js
      if (!this.ballLaunched) {
        this.isCharging = true;
        this.ball.setVelocity(0, 0);
        this.matter.world.setGravity(0, 0);
      }
```

In the `this.keys.SPACE.on('up', ...)` handler, replace:

```js
      if (this.isCharging && !this.ballLaunched) {
        this.isCharging = false;
        this.ballLaunched = true;
        this.ball.body.allowGravity = true;
        this.ball.setVelocity(0, -this.launchPower - 200);
        this.ball.setVelocityX(-20);
      }
```

With:

```js
      if (this.isCharging && !this.ballLaunched) {
        this.isCharging = false;
        this.ballLaunched = true;
        this.matter.world.setGravity(0, 1);
        this.ball.setVelocity(-20, -(this.launchPower + 200));
      }
```

- [ ] **Step 2: Update touch launch button handlers the same way**

In `launchBtn.on('pointerdown', ...)`, replace:

```js
        if (!this.ballLaunched) {
          this.isCharging = true;
          this.ball.setVelocity(0, 0);
          this.ball.body.allowGravity = false;
        }
```

With:

```js
        if (!this.ballLaunched) {
          this.isCharging = true;
          this.ball.setVelocity(0, 0);
          this.matter.world.setGravity(0, 0);
        }
```

In `launchBtn.on('pointerup', ...)`, replace:

```js
        if (this.isCharging && !this.ballLaunched) {
          this.isCharging = false;
          this.ballLaunched = true;
          this.ball.body.allowGravity = true;
          this.ball.setVelocity(0, -this.launchPower - 200);
          this.ball.setVelocityX(-20);
        }
```

With:

```js
        if (this.isCharging && !this.ballLaunched) {
          this.isCharging = false;
          this.ballLaunched = true;
          this.matter.world.setGravity(0, 1);
          this.ball.setVelocity(-20, -(this.launchPower + 200));
        }
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: update launch input for Matter.js velocity API

- Use this.matter.world.setGravity(0,0) to disable gravity during charge
  instead of ball.body.allowGravity = false
- Restore gravity on launch
- Combine setVelocity calls to use Matter's setVelocity(x, y) signature
- Updated both keyboard and touch handlers"
```

---

### Task 7: Fix update loop — remove funnel collision, fix re-launch, adapt flipper velocity

**Files:**
- Modify: `src/scenes/GameScene.js:377-497` (`update` method and `checkFunnelCollision`, `isFlipperActive`)

- [ ] **Step 1: Update flipper velocity setters for Matter.js API**

In the left flipper collision block, replace:

```js
          this.ball.body.setVelocityY(Math.min(0, this.ball.body.velocity.y - 600));
          this.ball.body.setVelocityX(this.ball.body.velocity.x - 200);
```

With:

```js
          this.ball.setVelocity(
            this.ball.body.velocity.x - 200,
            Math.min(0, this.ball.body.velocity.y - 600)
          );
```

In the right flipper collision block, replace:

```js
          this.ball.body.setVelocityY(Math.min(0, this.ball.body.velocity.y - 600));
          this.ball.body.setVelocityX(this.ball.body.velocity.x + 200);
```

With:

```js
          this.ball.setVelocity(
            this.ball.body.velocity.x + 200,
            Math.min(0, this.ball.body.velocity.y - 600)
          );
```

- [ ] **Step 2: Remove funnel collision check calls and `hasFallenBackOnce` logic**

Delete these lines from inside the `if (this.ball && this.ballLaunched)` block:

```js
      // Funnel collision — check both diagonal lines
      this.checkFunnelCollision(this.leftFunnelLine, 'left');
      this.checkFunnelCollision(this.rightFunnelLine, 'right');

      // Detect ball falling back into launch lane — allow re-launch (once per ball)
      if (!this.hasFallenBackOnce && this.ball.y > 520 && this.ball.x > 620 && this.ball.body.velocity.y > 0) {
        this.hasFallenBackOnce = true;
        this.ballLaunched = false;
        this.isCharging = false;
        this.launchPower = 0;
        this.ball.setVelocity(0, 0);
        this.ball.body.allowGravity = false;
      }
```

Replace with unconditional re-launch detection:

```js
      // Detect ball in launch lane — allow unlimited re-launch
      if (this.ball.x > 620 && this.ball.y > 520 && this.ball.body.velocity.y > 0) {
        this.ballLaunched = false;
        this.isCharging = false;
        this.launchPower = 0;
        this.ball.setVelocity(0, 0);
        this.matter.world.setGravity(0, 0);
      }
```

- [ ] **Step 3: Remove `checkFunnelCollision()` method entirely**

Delete the entire `checkFunnelCollision` method (lines ~455-497).

- [ ] **Step 4: Remove `funnelCollisionCooldown` and `hasFallenBackOnce` from game state**

In `create()`, remove:

```js
    this.funnelCollisionCooldown = { left: 0, right: 0 };
    this.hasFallenBackOnce = false;
```

- [ ] **Step 5: Remove `this.hasFallenBackOnce = false;` from `spawnBall()`**

Delete the line `this.hasFallenBackOnce = false;` from `spawnBall()`.

- [ ] **Step 6: Update drain detection for Matter.js**

In the drain check, the current code uses `this.ball.y > 1050`. This still works since Matter updates sprite position. No change needed — verify it works.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat: fix update loop for Matter.js — remove funnel collision, fix re-launch

- Removed checkFunnelCollision method and funnelCollisionCooldown state
  (funnel now handled by Matter rotated static bodies)
- Replaced hasFallenBackOnce flag with unconditional launch-lane detection
  for unlimited re-launch support
- Updated flipper velocity setters to use Matter setVelocity(x, y) API
- Disabled gravity during re-launch using setGravity(0,0)"
```

---

### Task 8: Clean up `loseLife()` for Matter.js

**Files:**
- Modify: `src/scenes/GameScene.js:507-527` (`loseLife` method)

- [ ] **Step 1: Verify drain detection still works**

In the `update()` method, the drain check uses `this.ball.y > 1050`. For Matter sprites, the game object position syncs with the body automatically, so this works without change. Verify it works.

- [ ] **Step 2: Final integration test**

Run: `npm run dev`

Expected results for all test criteria:
1. Ball launches cleanly without getting stuck in the launch lane
2. Ball bounces energetically off bumpers with satisfying force (restitution 1.2)
3. Ball bounces naturally off walls (restitution 0.8)
4. Funnel guides ball toward drain gap correctly (rotated static bodies)
5. Ceiling and floor walls match side wall thickness visually (all 16px)
6. Re-launch works unlimited times while ball stays in launch lane
7. Re-launch works when ball falls back from play area during gameplay
8. All 3 lives drain and respawn correctly
9. Game over flow works

- [ ] **Step 3: Commit if any changes were needed, otherwise mark complete**

---

## Self-Review

**Spec coverage:**
- [x] Physics engine migration (Arcade → Matter) — Task 1
- [x] Uniform wall thickness (16px static rectangles) — Task 2
- [x] Funnel as rotated static rectangles — Task 2
- [x] Bumper static circles with restitution 1.2 — Task 3
- [x] Ball tuned circle body (restitution 0.8, friction 0, frictionAir 0.0001, density 0.001) — Task 4
- [x] Collisionstart event for bumper scoring — Task 5
- [x] Flipper collision stays manual with Matter velocity API — Task 7
- [x] Unlimited re-launch via launch-lane detection — Task 7
- [x] Gravity toggle during charge/launch — Task 6
- [x] Drain detection preserved — Task 8
- [x] Game over flow preserved — Task 8

**Placeholder scan:** No TBDs, no "add validation", no vague steps. All code blocks are complete.

**Type consistency:**
- `this.matter.add.rectangle()` for walls/funnel — consistent
- `this.matter.add.circle()` for ball and bumpers — consistent
- `this.ball.setVelocity(x, y)` — Matter API used throughout
- `this.matter.world.setGravity()` for charge/launch — consistent
- `this.bumperBodies` Map for collision detection — defined in Task 3, used in Task 5
- `this.ball.body.velocity.x/y` for flipper check — valid Matter API

**Task dependency order:** Config → Walls → Bumpers → Ball → Collision → Input → Update → Cleanup. Each task depends on the previous, verified in-browser at the end.

