import Phaser from 'phaser';

const Matter = Phaser.Physics.Matter.Matter;

const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.6,
  baseVel:    5,
  velScale:   0.00625,
  xVel:       -10
};

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {}

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

    // Piston lengths for rest and active flipper positions
    this.pistonRestLength = 75.7;
    this.pistonActiveLength = 61.3;

    this.addBackground();
    this.buildTable();
    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();

    const highScore = parseInt(localStorage.getItem('earkandi_highscore') || '0');
    document.getElementById('high-score').textContent = 'HI: ' + highScore;

    this.setupInput();
    this.setupCollisions();
    this.spawnBall();
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
    // Uniform static wall rectangles — all 16px thick
    this.matter.add.rectangle(8, 525, 16, 1050, { isStatic: true });       // left
    this.matter.add.rectangle(692, 525, 16, 1050, { isStatic: true });    // right
    this.matter.add.rectangle(350, 8, 700, 16, { isStatic: true });       // top
    this.matter.add.rectangle(155, 1016, 278, 16, { isStatic: true });   // bottom left (x=16..294)
    this.matter.add.rectangle(513, 1016, 342, 16, { isStatic: true });   // bottom right (x=342..684)
    this.matter.add.rectangle(620, 768, 16, 512, { isStatic: true });     // launch lane divider (y=512..1024)
    this.matter.add.rectangle(660, 1020, 52, 16, { isStatic: true });   // launch lane bottom stop

    // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (16,700) → (294,1016)
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 294, 1016);
    this.matter.add.rectangle(155, 858, 421, 16, { isStatic: true, angle: leftAngle });

    // Right funnel: (620,700) → (342,1016)
    const rightAngle = Phaser.Math.Angle.Between(620, 700, 342, 1016);
    this.matter.add.rectangle(481, 858, 421, 16, { isStatic: true, angle: rightAngle });

    // Visual representation of funnel lines (rendering only)
    const funnelGfx = this.add.graphics();
    funnelGfx.lineStyle(4, 0x3a3a6a, 1);
    funnelGfx.lineBetween(16, 700, 294, 1016);
    funnelGfx.lineBetween(620, 700, 342, 1016);

    // Wall visuals — 8px stroke outlines
    const wallGfx = this.add.graphics();
    wallGfx.lineStyle(8, 0x5a5a8a, 1);
    wallGfx.strokeRect(0, 0, 16, 1050);          // left
    wallGfx.strokeRect(684, 0, 16, 1050);       // right
    wallGfx.strokeRect(0, 0, 700, 16);          // top
    wallGfx.strokeRect(16, 1008, 278, 16);      // bottom left (x=16..294)
    wallGfx.strokeRect(342, 1008, 342, 16);     // bottom right (x=342..684)
    wallGfx.strokeRect(612, 512, 16, 512);      // launch lane divider
    wallGfx.strokeRect(634, 1012, 52, 16);      // launch lane stop
  }

  buildBumpers() {
    const bumperDefs = [
      { x: 312, y: 80,  points: 250, type: 'flower', key: 'bumper-flower' },
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
  }

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

  buildUI() {
    // Launch power indicator
    this.powerBarBg = this.add.rectangle(40, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(40, 680, 20, 10, 0x57fb88)
      .setOrigin(0.5, 1);

    // Track current power bar height for scaling
    this.powerBarHeight = 10;
  }

  setupInput() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Space to launch
    this.keys = this.input.keyboard.addKeys('SPACE,ENTER');

    this.keys.SPACE.on('down', () => {
      if (!this.ballLaunched) {
        this.isCharging = true;
        this.ball.setVelocity(0, 0);
        this.matter.world.setGravity(0, 0);
      }
    });

    this.keys.SPACE.on('up', () => {
      if (this.isCharging && !this.ballLaunched) {
        this.isCharging = false;
        this.ballLaunched = true;
        this.matter.world.setGravity(0, 1);
        this.ball.setVelocity(LAUNCH.xVel, -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale));
      }
    });

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

      launchBtn.on('pointerdown', () => {
        if (!this.ballLaunched) {
          this.isCharging = true;
          this.ball.setVelocity(0, 0);
          this.matter.world.setGravity(0, 0);
        }
      });

      launchBtn.on('pointerup', () => {
        if (this.isCharging && !this.ballLaunched) {
          this.isCharging = false;
          this.ballLaunched = true;
          this.matter.world.setGravity(0, 1);
          this.ball.setVelocity(LAUNCH.xVel, -(LAUNCH.baseVel + this.launchPower * LAUNCH.velScale));
        }
      });
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
      const maxSpeed = 300;
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        this.ball.body.velocity.x *= scale;
        this.ball.body.velocity.y *= scale;
      }
    }

    // Detect ball fell back into launch lane — allow relaunch
    if (this.ball && this.ball.x > 620 && this.ball.y > 520 && this.ball.body.velocity.y > 0) {
      this.ballLaunched = false;
      this.isCharging = false;
      this.launchPower = 0;
    }

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

   }

  updateScoreDisplay() {
    document.getElementById('score-display').textContent = this.score;
  }

  updateLivesDisplay() {
    document.getElementById('lives-display').textContent = 'Hearts: ' + this.lives;
  }

  loseLife() {
    if (this.isLosingLife) return;
    this.isLosingLife = true;
    this.lives--;
    this.updateLivesDisplay();
    this.sound.play('ball-drain');

    if (this.lives <= 0) {
      // Game over
      const currentHigh = parseInt(localStorage.getItem('earkandi_highscore') || '0');
      const newHigh = Math.max(currentHigh, this.score);
      localStorage.setItem('earkandi_highscore', newHigh.toString());

      document.getElementById('high-score').textContent = 'HI: ' + newHigh;

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
