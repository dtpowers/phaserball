import Phaser from 'phaser';

const Matter = Phaser.Physics.Matter.Matter;

const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.9,
  baseVel:    5,
  velScale:   0.013125,
  xVel:       -10
};

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    // Game state
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;
    this.isLosingLife = false;
    this.launchClosureBody = null;
    this.launchClosureActive = false;
    this.launchClosureGfx = null;

    this.addBackground();
    this.buildTable();

    // World bounds safety net — prevents ball escaping if tunneling occurs
    this.matter.world.setBounds(0, 0, 700, 1050, true, false, true, true);

    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();

    const highScore = parseInt(localStorage.getItem('earkandi_highscore') || '0');
    document.getElementById('hi-value').textContent = highScore;

    this.setupInput();
    this.setupCollisions();
    this.spawnBall();
    this.updateLivesDisplay();
  }

  addBackground() {
    // Subtle gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e,
      0, 0, 0, 700, 1050, 0
    );
    bg.fillRect(0, 0, 700, 1050);

    // Scattered decorative shapes (earkandi aesthetic)
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    for (let i = 0; i < 15; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(50, 650),
        Phaser.Math.Between(50, 990),
        shapes[i % shapes.length]
      ).setScale(0.2).setAlpha(0.15);

      this.tweens.add({
        targets: shape,
        angle: shape.angle + Phaser.Math.Between(180, 360),
        duration: Phaser.Math.Between(6000, 12000),
        repeat: -1,
        ease: 'Linear'
      });

      this.tweens.add({
        targets: shape,
        x: shape.x + Phaser.Math.Between(-15, 15),
        y: shape.y + Phaser.Math.Between(-15, 15),
        duration: Phaser.Math.Between(8000, 15000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

  }

  buildTable() {
    // Uniform static wall rectangles — all 16px thick, slight bounce
    const wallOpts = { isStatic: true, restitution: 0.3 };
    this.matter.add.rectangle(8, 525, 16, 1050, wallOpts);       // left
    this.matter.add.rectangle(692, 525, 16, 1050, wallOpts);    // right
    this.matter.add.rectangle(350, 8, 700, 16, wallOpts);       // top
    this.matter.add.rectangle(155, 1016, 278, 16, wallOpts);    // bottom left
    this.matter.add.rectangle(513, 1016, 342, 16, wallOpts);    // bottom right
    this.matter.add.rectangle(620, 768, 16, 512, wallOpts);     // launch lane divider
    this.matter.add.rectangle(660, 1020, 52, 16, wallOpts);     // launch lane bottom stop

    // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (16,700) → (294,1016)
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    this.matter.add.rectangle(155, 858, 421, 16, { ...wallOpts, angle: leftAngle });

    // Right funnel: (620,700) → (342,1016)
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
    wallGfx.strokeRect(0, 0, 16, 1008);          // left
    wallGfx.strokeRect(684, 0, 16, 1008);       // right
    wallGfx.strokeRect(0, 0, 700, 16);          // top
    wallGfx.strokeRect(16, 1008, 278, 16);      // bottom left (x=16..294)
    wallGfx.strokeRect(342, 1008, 342, 16);     // bottom right (x=342..684)
    wallGfx.strokeRect(612, 512, 16, 512);      // launch lane divider
    wallGfx.strokeRect(634, 1012, 50, 16);      // launch lane stop
  }

  buildBumpers() {
    const bumperDefs = [
      { x: 350, y: 525, points: 250, type: 'flower', key: 'bumper-flower' },
      { x: 186, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 340, y: 140, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 494, y: 160, points: 100, type: 'star',   key: 'bumper-star' },
      { x: 266, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
      { x: 414, y: 250, points: 150, type: 'heart',  key: 'bumper-heart' },
      { x: 206, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
      { x: 340, y: 330, points: 200, type: 'moon',   key: 'bumper-moon' },
      { x: 474, y: 350, points: 200, type: 'moon',   key: 'bumper-moon' },
    ];

    this.bumperBodies = new Map();

    bumperDefs.forEach(def => {
      // Visual bumper sprite (no physics)
      const bumper = this.add.image(def.x, def.y, def.key);
      bumper.setScale(0.288);

      // Physics body — static circle with high restitution for energetic bounce
      const body = this.matter.add.circle(def.x, def.y, 36, {
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

  buildFlippers() {
    // Left flipper — pivot at left edge (x=121.6), extends rightward
    this.leftFlipper = this.add.image(121.6, 820, 'flipper');
    this.leftFlipper.setOrigin(0, 0.5);
    this.leftFlipper.setAngle(20);
    this.leftFlipper.setDepth(2);

    // Dynamic physics body for left flipper — tapered trapezoid via fromVertices
    const leftFlipperVerts = [
      { x: -78, y: -14 },  // pivot-end top (wide)
      { x: 78,  y: -4 },   // tip-end top (narrow)
      { x: 78,  y: 4 },    // tip-end bottom (narrow)
      { x: -78, y: 14 },   // pivot-end bottom (wide)
    ];
    this.leftFlipperBody = this.matter.add.fromVertices(
        199.8, 820, leftFlipperVerts, {
            restitution: 0.2,
            friction: 0.4,
            isSleepingAllowed: false
        }, true
    );
    // fromVertices computes centroid, not the passed (x,y) — correct position
    Matter.Body.setPosition(this.leftFlipperBody, { x: 199.8, y: 820 });

    // Constraint pins left end of the body (offset -78px from center)
    this.leftFlipperConstraint = this.matter.add.worldConstraint(
      this.leftFlipperBody, 0, 0.9,
      { pointA: { x: 121.6, y: 820 }, pointB: { x: -78, y: 0 } }
    );

    // Right flipper — pivot at right edge (x=514.4), extends leftward
    this.rightFlipper = this.add.image(514.4, 820, 'flipper-right');
    this.rightFlipper.setOrigin(1, 0.5);
    this.rightFlipper.setAngle(-20);
    this.rightFlipper.setDepth(2);

    // Dynamic physics body for right flipper — mirrored trapezoid
    const rightFlipperVerts = [
      { x: 78,  y: -14 },  // pivot-end top (wide)
      { x: -78, y: -4 },   // tip-end top (narrow)
      { x: -78, y: 4 },    // tip-end bottom (narrow)
      { x: 78,  y: 14 },   // pivot-end bottom (wide)
    ];
    this.rightFlipperBody = this.matter.add.fromVertices(
        436.2, 820, rightFlipperVerts, {
            restitution: 0.2,
            friction: 0.4,
            isSleepingAllowed: false
        }, true
    );
    // fromVertices computes centroid, not the passed (x,y) — correct position
    Matter.Body.setPosition(this.rightFlipperBody, { x: 436.2, y: 820 });

    // Constraint pins right end of the body (offset +78px from center)
    this.rightFlipperConstraint = this.matter.add.worldConstraint(
      this.rightFlipperBody, 0, 0.9,
      { pointA: { x: 514.4, y: 820 }, pointB: { x: 78, y: 0 } }
    );

    // Flipper rest and active angles — swing upward
    this.flipperRestAngle = { left: 20, right: -20 };
    this.flipperActiveAngle = { left: -30, right: 30 };
  }

  flipLeft() {
    this.tweens.add({
      targets: this.leftFlipper,
      angle: this.flipperActiveAngle.left,
      duration: 60,
      ease: 'Sine.easeOut'
    });
    this.sound.play('flipper-activate');
  }

  releaseLeft() {
    this.tweens.add({
      targets: this.leftFlipper,
      angle: this.flipperRestAngle.left,
      duration: 120,
      ease: 'Sine.easeOut'
    });
  }

  flipRight() {
    this.tweens.add({
      targets: this.rightFlipper,
      angle: this.flipperActiveAngle.right,
      duration: 60,
      ease: 'Sine.easeOut'
    });
    this.sound.play('flipper-activate');
  }

  releaseRight() {
    this.tweens.add({
      targets: this.rightFlipper,
      angle: this.flipperRestAngle.right,
      duration: 120,
      ease: 'Sine.easeOut'
    });
  }

  buildUI() {
    // Launch power indicator
    this.powerBarBg = this.add.rectangle(40, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(40, 680, 20, 10, 0x57fb88)
      .setOrigin(0.5, 1);

    // Track current power bar height for scaling
    this.powerBarHeight = 10;
  }

  startCharge() {
    if (this.ballLaunched || this.isCharging) return;
    this.isCharging = true;
    this.ball.setVelocity(0, 0);
    this.matter.world.setGravity(0, 0);
  }

  releaseCharge() {
    if (!this.isCharging || this.ballLaunched) return;
    this.isCharging = false;
    this.ballLaunched = true;
    this.matter.world.setGravity(0, 1);
    this.ball.setVelocity(LAUNCH.xVel, -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale));
  }

  setupInput() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Space to launch
    this.keys = this.input.keyboard.addKeys('SPACE,ENTER');

    this.keys.SPACE.on('down', () => this.startCharge());
    this.keys.SPACE.on('up', () => this.releaseCharge());

    // Keyboard flipper control
    const flipperKeys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT');

    const onLeftFlipperDown = () => this.flipLeft();
    const onLeftFlipperUp = () => this.releaseLeft();

    const onRightFlipperDown = () => this.flipRight();
    const onRightFlipperUp = () => this.releaseRight();

    flipperKeys.A.on('down', onLeftFlipperDown);
    flipperKeys.A.on('up', onLeftFlipperUp);
    flipperKeys.LEFT.on('down', onLeftFlipperDown);
    flipperKeys.LEFT.on('up', onLeftFlipperUp);

    flipperKeys.D.on('down', onRightFlipperDown);
    flipperKeys.D.on('up', onRightFlipperUp);
    flipperKeys.RIGHT.on('down', onRightFlipperDown);
    flipperKeys.RIGHT.on('up', onRightFlipperUp);

    // Touch controls
    if (isTouchDevice) {
      const leftBtn = this.add.image(100, 950, 'btn-flip-left')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      leftBtn.on('pointerdown', onLeftFlipperDown);
      leftBtn.on('pointerup', onLeftFlipperUp);
      leftBtn.on('pointerout', onLeftFlipperUp);

      const rightBtn = this.add.image(570, 950, 'btn-flip-right')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      rightBtn.on('pointerdown', onRightFlipperDown);
      rightBtn.on('pointerup', onRightFlipperUp);
      rightBtn.on('pointerout', onRightFlipperUp);

      const launchBtn = this.add.image(668, 980, 'btn-launch')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.7);

      launchBtn.on('pointerdown', () => this.startCharge());
      launchBtn.on('pointerup', () => this.releaseCharge());
    }
  }

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

  spawnBall() {
    this.isLosingLife = false;

    this.ball = this.matter.add.image(652, 950, 'ball', null, {
      restitution: 0.8,
      friction: 0,
      frictionAir: 0.0001,
      density: 0.001,
      slop: 0.01,
      shape: { type: 'circle', radius: 16 }
    });

    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;

    // Reset launch lane closure
    if (this.launchClosureBody) {
      this.matter.world.remove(this.launchClosureBody);
      this.launchClosureBody = null;
    }
    this.launchClosureActive = false;

    // Reset launch lane closure visual
    if (this.launchClosureGfx) {
      this.launchClosureGfx.destroy();
      this.launchClosureGfx = null;
    }
  }

  update(time, delta) {
    // Launch charging
    if (!this.ballLaunched && this.isCharging) {
      this.powerBarBg.setVisible(true);
      this.powerBarFill.setVisible(true);

      this.launchPower = Math.min(LAUNCH.maxPower, this.launchPower + delta * LAUNCH.chargeRate);

      // Update power bar height
      this.powerBarHeight = this.launchPower * 0.1;
      this.powerBarFill.setScale(1, this.powerBarHeight / 10);

      // Update power bar color (green to red as power increases)
      const ratio = this.launchPower / 2000;
      const r = Math.floor(Phaser.Math.Linear(0x57, 0xe9, ratio));
      const gr = Math.floor(Phaser.Math.Linear(0xfb, 0x45, ratio));
      const b = Math.floor(Phaser.Math.Linear(0x88, 0x60, ratio));
      this.powerBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, gr, b));
    } else {
      this.powerBarBg.setVisible(false);
      this.powerBarFill.setVisible(false);

      this.powerBarHeight = 10;
      this.powerBarFill.setScale(1, 1);
      this.powerBarFill.setFillStyle(0x57fb88);
    }

    // Check if ball has drained
    if (this.ball && this.ball.y > 1050) {
      this.loseLife();
    }

    // Clamp ball velocity to prevent tunneling
    if (this.ball && this.ball.body) {
      const vx = this.ball.body.velocity.x;
      const vy = this.ball.body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const maxSpeed = 200;
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        this.ball.body.velocity.x *= scale;
        this.ball.body.velocity.y *= scale;
      }
    }

    // Sync flipper physics bodies to visual position and angle
    // Zero velocity BEFORE setPosition to prevent Matter.js from
    // interpreting the position delta as enormous velocity
    if (this.leftFlipper && this.leftFlipperBody) {
      Matter.Body.setVelocity(this.leftFlipperBody, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.leftFlipperBody, 0);
      Matter.Body.setPosition(this.leftFlipperBody, {
        x: this.leftFlipper.x + 78,
        y: this.leftFlipper.y
      });
      Matter.Body.setAngle(this.leftFlipperBody, Phaser.Math.DegToRad(this.leftFlipper.angle));
    }

    if (this.rightFlipper && this.rightFlipperBody) {
      Matter.Body.setVelocity(this.rightFlipperBody, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.rightFlipperBody, 0);
      Matter.Body.setPosition(this.rightFlipperBody, {
        x: this.rightFlipper.x - 78,
        y: this.rightFlipper.y
      });
      Matter.Body.setAngle(this.rightFlipperBody, Phaser.Math.DegToRad(this.rightFlipper.angle));
    }

    // Detect ball fell back into launch lane — allow relaunch
    if (this.ball && this.ball.x > 620 && this.ball.y > 520 && this.ball.body.velocity.y > 0) {
      this.ballLaunched = false;
      this.isCharging = false;
      this.launchPower = 0;
    }

    // Launch lane closure — seal the lane when ball exits upward
    if (this.ball && !this.launchClosureActive && this.ball.x < 600 && this.ball.y < 520 && this.ball.body.velocity.y < 0) {
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
  }

  updateScoreDisplay() {
    const el = document.getElementById('score-value');
    el.textContent = this.score;
    // Trigger pop animation
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  }

  updateLivesDisplay() {
    document.getElementById('lives-display').textContent = '⚪'.repeat(this.lives);
  }

  loseLife() {
    if (this.isLosingLife) return;
    this.isLosingLife = true;
    this.lives--;
    this.updateLivesDisplay();
    this.sound.play('ball-drain');
    this.cameras.main.shake(200, 0.03);

    if (this.lives <= 0) {
      // Game over
      const currentHigh = parseInt(localStorage.getItem('earkandi_highscore') || '0');
      const newHigh = Math.max(currentHigh, this.score);
      localStorage.setItem('earkandi_highscore', newHigh.toString());

      document.getElementById('hi-value').textContent = newHigh;

      this.scene.launch('GameOverScene', { score: this.score, highScore: newHigh });
      this.scene.stop('GameScene');
    } else {
      // Respawn ball
      this.ball.destroy();
      this.ball = null;
      this.time.delayedCall(1000, () => this.spawnBall());
    }
  }
}
