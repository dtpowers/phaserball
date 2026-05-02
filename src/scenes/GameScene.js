import Phaser from 'phaser';

const LAUNCH = {
  maxPower:   2000,
  chargeRate: 0.5,
  baseVel:    80,
  velScale:   0.1,
  xVel:       -15
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
    }

  }

  buildTable() {
    // Uniform static wall rectangles — all 16px thick
    this.matter.add.rectangle(8, 525, 16, 1050, { isStatic: true });       // left
    this.matter.add.rectangle(692, 525, 16, 1050, { isStatic: true });    // right
    this.matter.add.rectangle(350, 8, 700, 16, { isStatic: true });       // top
    this.matter.add.rectangle(145, 1016, 260, 16, { isStatic: true });    // bottom left (drain gap x=275..425)
    this.matter.add.rectangle(555, 1016, 260, 16, { isStatic: true });    // bottom right
    this.matter.add.rectangle(620, 768, 16, 512, { isStatic: true });     // launch lane divider (y=512..1024)

    // Funnel — rotated static rectangles at midpoint of each diagonal
    // Left funnel: (16,700) → (275,1016), length ~409px
    const leftAngle = Phaser.Math.Angle.Between(16, 700, 275, 1016);
    this.matter.add.rectangle(145, 858, 410, 8, { isStatic: true, angle: leftAngle });

    // Right funnel: (620,700) → (425,1016), length ~409px
    const rightAngle = Phaser.Math.Angle.Between(620, 700, 425, 1016);
    this.matter.add.rectangle(522, 858, 410, 8, { isStatic: true, angle: rightAngle });

    // Visual representation of funnel lines (rendering only)
    const funnelGfx = this.add.graphics();
    funnelGfx.lineStyle(4, 0x3a3a6a, 1);
    funnelGfx.lineBetween(16, 700, 275, 1016);
    funnelGfx.lineBetween(620, 700, 425, 1016);

    // Wall visuals — 8px stroke outlines
    const wallGfx = this.add.graphics();
    wallGfx.lineStyle(8, 0x5a5a8a, 1);
    wallGfx.strokeRect(0, 0, 16, 1050);          // left
    wallGfx.strokeRect(684, 0, 16, 1050);       // right
    wallGfx.strokeRect(0, 0, 700, 16);          // top
    wallGfx.strokeRect(16, 1008, 310, 16);      // bottom left
    wallGfx.strokeRect(374, 1008, 318, 16);     // bottom right
    wallGfx.strokeRect(612, 512, 16, 512);      // launch lane divider
  }

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
    // Left flipper — pivot at left edge, extends rightward
    this.leftFlipper = this.add.image(190, 820, 'flipper');
    this.leftFlipper.setOrigin(0, 0.5);
    this.leftFlipper.setAngle(20);

    // Right flipper — pivot at RIGHT edge, extends leftward
    this.rightFlipper = this.add.image(510, 820, 'flipper');
    this.rightFlipper.setOrigin(1, 0.5);
    this.rightFlipper.setAngle(-20);

    // Flipper rest and active angles — swing upward
    this.flipperRestAngle = { left: 20, right: -20 };
    this.flipperActiveAngle = { left: -30, right: 30 };
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

    const onLeftFlipperDown = () => {
      this.tweens.add({
        targets: this.leftFlipper,
        angle: this.flipperActiveAngle.left,
        duration: 60,
        ease: 'Sine.easeOut'
      });
      this.sound.play('flipper-activate');
    };

    const onLeftFlipperUp = () => {
      this.tweens.add({
        targets: this.leftFlipper,
        angle: this.flipperRestAngle.left,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    };

    const onRightFlipperDown = () => {
      this.tweens.add({
        targets: this.rightFlipper,
        angle: this.flipperActiveAngle.right,
        duration: 60,
        ease: 'Sine.easeOut'
      });
      this.sound.play('flipper-activate');
    };

    const onRightFlipperUp = () => {
      this.tweens.add({
        targets: this.rightFlipper,
        angle: this.flipperRestAngle.right,
        duration: 120,
        ease: 'Sine.easeOut'
      });
    };

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
      const ratio = this.launchPower / 1000;
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

    // Flipper collision
    if (this.ball && this.ballLaunched) {
      // Left flipper
      if (this.isFlipperActive(this.leftFlipper, this.flipperActiveAngle.left)) {
        const distL = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.leftFlipper.x, this.leftFlipper.y
        );
        if (distL < 80 && this.ball.y > 770 && this.ball.y < 870) {
          this.ball.setVelocity(
            this.ball.body.velocity.x - 200,
            Math.min(0, this.ball.body.velocity.y - 600)
          );
        }
      }

      // Right flipper
      if (this.isFlipperActive(this.rightFlipper, this.flipperActiveAngle.right)) {
        const distR = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.rightFlipper.x, this.rightFlipper.y
        );
        if (distR < 80 && this.ball.y > 770 && this.ball.y < 870) {
          this.ball.setVelocity(
            this.ball.body.velocity.x + 200,
            Math.min(0, this.ball.body.velocity.y - 600)
          );
        }
      }

      // Detect ball in launch lane — allow unlimited re-launch
      if (this.ball.x > 620 && this.ball.y > 520 && this.ball.body.velocity.y > 0) {
        this.ballLaunched = false;
        this.isCharging = false;
        this.launchPower = 0;
        this.ball.setVelocity(0, 0);
        this.matter.world.setGravity(0, 0);
      }
    }
  }

  isFlipperActive(flipper, activeAngle) {
    return Math.abs(flipper.angle - activeAngle) < 5;
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
