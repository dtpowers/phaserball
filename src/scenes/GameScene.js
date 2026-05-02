import Phaser from 'phaser';

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
    this.funnelCollisionCooldown = { left: 0, right: 0 };
    this.hasFallenBackOnce = false;

    this.addBackground();
    this.buildTable();
    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();
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

    // Earkandi branding text at top
    this.add.text(350, 18, 'earkandi PINBALL', {
      fontSize: '18px', color: '#c77dff', fontFamily: 'Arial',
      letterSpacing: 4
    }).setOrigin(0.5);
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
  }

  buildBumpers() {
    this.bumpers = this.physics.add.staticGroup();

    // Flower bumper (250 pts)
    const flower = this.bumpers.create(312, 80, 'bumper-flower');
    flower.setData('points', 250);
    flower.setData('type', 'flower');

    // Star bumpers (100 pts)
    const starPositions = [
      { x: 180, y: 160 }, { x: 340, y: 140 }, { x: 500, y: 160 }
    ];
    starPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-star');
      bumper.setData('points', 100);
      bumper.setData('type', 'star');
    });

    // Heart bumpers (150 pts)
    const heartPositions = [
      { x: 260, y: 250 }, { x: 420, y: 250 }
    ];
    heartPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-heart');
      bumper.setData('points', 150);
      bumper.setData('type', 'heart');
    });

    // Moon bumpers (200 pts)
    const moonPositions = [
      { x: 200, y: 350 }, { x: 340, y: 330 }, { x: 480, y: 350 }
    ];
    moonPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-moon');
      bumper.setData('points', 200);
      bumper.setData('type', 'moon');
    });

    // Glow overlay for each bumper
    this.bumpers.getChildren().forEach(bumper => {
      const glow = this.add.circle(
        bumper.x, bumper.y, 48, 0xffffff, 0.05
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
    // Score display
    this.scoreText = this.add.text(350, 40, '0', {
      fontSize: '48px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // Lives display
    this.livesText = this.add.text(80, 40, 'Hearts: 3', {
      fontSize: '28px', color: '#ff6b9d', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // High score
    const highScore = parseInt(localStorage.getItem('earkandi_highscore') || '0');
    this.highScoreText = this.add.text(620, 40, `HI: ${highScore}`, {
      fontSize: '24px', color: '#0ff0fc', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

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
        this.ball.body.allowGravity = false;
      }
    });

    this.keys.SPACE.on('up', () => {
      if (this.isCharging && !this.ballLaunched) {
        this.isCharging = false;
        this.ballLaunched = true;
        this.ball.body.allowGravity = true;
        this.ball.setVelocity(0, -this.launchPower - 200);
        this.ball.setVelocityX(-20);
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
          this.ball.body.allowGravity = false;
        }
      });

      launchBtn.on('pointerup', () => {
        if (this.isCharging && !this.ballLaunched) {
          this.isCharging = false;
          this.ballLaunched = true;
          this.ball.body.allowGravity = true;
          this.ball.setVelocity(0, -this.launchPower - 200);
          this.ball.setVelocityX(-20);
        }
      });
    }
  }

  setupCollisions() {
    // Ball group — colliders are set up once and always reference the current ball
    this.ballGroup = this.physics.add.group();
    this.physics.add.collider(this.ballGroup, this.walls);

    this.physics.add.collider(this.ballGroup, this.bumpers, (ball, bumper) => {
      const points = bumper.getData('points');
      this.score += points;
      this.updateScoreDisplay();

      // Visual feedback — brief scale pulse
      this.tweens.add({
        targets: bumper,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });

      // Audio feedback
      this.sound.play('bumper-hit');

      // Score popup
      const popup = this.add.text(bumper.x, bumper.y - 40, `+${points}`, {
        fontSize: '28px', color: '#ffffff', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);

      this.tweens.add({
        targets: popup,
        y: bumper.y - 100,
        alpha: 0,
        duration: 800,
        onComplete: () => popup.destroy()
      });
    });
  }

  spawnBall() {
    this.isLosingLife = false;

    this.ball = this.ballGroup.create(652, 950, 'ball');
    this.ball.setCollideWorldBounds(false);
    this.ball.setBounce(0.4);
    this.ball.setCircle(16);

    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;
    this.hasFallenBackOnce = false;
  }

  update(time, delta) {
    // Launch charging
    if (!this.ballLaunched && this.isCharging) {
      this.powerBarBg.setVisible(true);
      this.powerBarFill.setVisible(true);

      this.launchPower = Math.min(1000, this.launchPower + delta * 0.7);

      // Update power bar height
      this.powerBarHeight = this.launchPower * 0.2;
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
          this.ball.body.setVelocityY(Math.min(0, this.ball.body.velocity.y - 600));
          this.ball.body.setVelocityX(this.ball.body.velocity.x - 200);
        }
      }

      // Right flipper
      if (this.isFlipperActive(this.rightFlipper, this.flipperActiveAngle.right)) {
        const distR = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.rightFlipper.x, this.rightFlipper.y
        );
        if (distR < 80 && this.ball.y > 770 && this.ball.y < 870) {
          this.ball.body.setVelocityY(Math.min(0, this.ball.body.velocity.y - 600));
          this.ball.body.setVelocityX(this.ball.body.velocity.x + 200);
        }
      }

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
    }
  }

  isFlipperActive(flipper, activeAngle) {
    return Math.abs(flipper.angle - activeAngle) < 5;
  }

  checkFunnelCollision(line, side) {
    // Decrement cooldown each frame
    this.funnelCollisionCooldown[side] = Math.max(0, this.funnelCollisionCooldown[side] - 1);
    if (this.funnelCollisionCooldown[side] > 0) return;

    const nearest = {};
    Phaser.Geom.Line.GetNearestPoint(line, { x: this.ball.x, y: this.ball.y }, nearest);

    const dist = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, nearest.x, nearest.y);
    const collisionRadius = 20; // ball radius (16) + 4px safety margin

    if (dist < collisionRadius) {
      // Push ball out of the line
      const pushAngle = Phaser.Math.Angle.Between(nearest.x, nearest.y, this.ball.x, this.ball.y);
      this.ball.body.setPosition(
        nearest.x + Math.cos(pushAngle) * collisionRadius,
        nearest.y + Math.sin(pushAngle) * collisionRadius
      );

      // Skip reflection if ball has no velocity — nothing to reflect
      const speed = Math.sqrt(
        this.ball.body.velocity.x ** 2 + this.ball.body.velocity.y ** 2
      );
      if (speed === 0) {
        this.funnelCollisionCooldown[side] = 2;
        return;
      }

      // Reflect the actual velocity vector across the line normal (proper specular reflection)
      const lineAngle = Phaser.Math.Angle.Between(line.x1, line.y1, line.x2, line.y2);
      const normalAngle = lineAngle - Math.PI / 2;
      const velocityAngle = Phaser.Math.Angle.Between(0, 0, this.ball.body.velocity.x, this.ball.body.velocity.y);
      const reflectAngle = 2 * normalAngle - velocityAngle;
      const damping = 0.7;
      this.ball.body.setVelocity(
        Math.cos(reflectAngle) * speed * damping,
        Math.sin(reflectAngle) * speed * damping
      );

      // Set cooldown to prevent repeated collision in next frames
      this.funnelCollisionCooldown[side] = 2;
    }
  }

  updateScoreDisplay() {
    this.scoreText.setText(this.score.toString());
  }

  updateLivesDisplay() {
    this.livesText.setText(`Hearts: ${this.lives}`);
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

      this.scene.launch('GameOverScene', { score: this.score, highScore: newHigh });
      this.scene.stop('GameScene');
    } else {
      // Respawn ball
      this.ball.destroy();
      this.time.delayedCall(1000, () => this.spawnBall());
    }
  }
}
