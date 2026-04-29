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

    this.addBackground();
    this.buildTable();
    this.buildBumpers();
    this.buildFlippers();
    this.buildUI();
    this.setupInput();
    this.spawnBall();
  }

  addBackground() {
    // Subtle gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e,
      0, 0, 0, 1024, 768, 0
    );
    bg.fillRect(0, 0, 1024, 768);

    // Scattered decorative shapes (earkandi aesthetic)
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    for (let i = 0; i < 15; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(50, 974),
        Phaser.Math.Between(50, 718),
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
    this.add.text(512, 28, 'earkandi PINBALL', {
      fontSize: '18px', color: '#c77dff', fontFamily: 'Arial',
      letterSpacing: 4
    }).setOrigin(0.5);
  }

  buildTable() {
    const walls = this.physics.add.staticGroup();

    // Left wall
    for (let y = 0; y < 768; y += 32) walls.create(16, y, 'wall');
    // Right wall
    for (let y = 0; y < 768; y += 32) walls.create(1008, y, 'wall');
    // Top wall
    for (let x = 16; x < 1008; x += 32) walls.create(x, 16, 'wall');

    // Launch lane divider wall
    for (let y = 16; y < 600; y += 32) walls.create(928, y, 'wall');

    // Bottom walls (left and right of drain)
    for (let x = 16; x < 400; x += 32) walls.create(x, 752, 'wall');
    for (let x = 624; x < 928; x += 32) walls.create(x, 752, 'wall');

    // Funnel walls
    for (let i = 0; i < 6; i++) {
      walls.create(200 + i * 60, 600 + i * 33, 'wall');
    }
    for (let i = 0; i < 6; i++) {
      walls.create(808 - i * 60, 600 + i * 33, 'wall');
    }

    // Side wall guides
    for (let i = 0; i < 4; i++) {
      walls.create(100 + i * 50, 480 + i * 30, 'wall');
    }
    for (let i = 0; i < 4; i++) {
      walls.create(824 - i * 50, 480 + i * 30, 'wall');
    }

    this.walls = walls;
  }

  buildBumpers() {
    this.bumpers = this.physics.add.staticGroup();

    // Star bumpers (100 pts) — outer ring
    const starPositions = [
      { x: 300, y: 200 }, { x: 500, y: 180 }, { x: 700, y: 200 }
    ];
    starPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-star');
      bumper.setData('points', 100);
      bumper.setData('type', 'star');
    });

    // Heart bumpers (150 pts) — middle row
    const heartPositions = [
      { x: 400, y: 300 }, { x: 600, y: 300 }
    ];
    heartPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-heart');
      bumper.setData('points', 150);
      bumper.setData('type', 'heart');
    });

    // Moon bumpers (200 pts) — inner row
    const moonPositions = [
      { x: 350, y: 400 }, { x: 500, y: 380 }, { x: 650, y: 400 }
    ];
    moonPositions.forEach(pos => {
      const bumper = this.bumpers.create(pos.x, pos.y, 'bumper-moon');
      bumper.setData('points', 200);
      bumper.setData('type', 'moon');
    });

    // Flower bumper (250 pts) — top center
    const flower = this.bumpers.create(500, 120, 'bumper-flower');
    flower.setData('points', 250);
    flower.setData('type', 'flower');

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
    // Left flipper
    this.leftFlipper = this.add.image(290, 700, 'flipper');
    this.leftFlipper.setOrigin(0, 0.5);
    this.leftFlipper.setAngle(-20);

    // Right flipper
    this.rightFlipper = this.add.image(734, 700, 'flipper');
    this.rightFlipper.setOrigin(0, 0.5);
    this.rightFlipper.setAngle(20);

    // Flipper rest and active angles
    this.flipperRestAngle = { left: -20, right: 20 };
    this.flipperActiveAngle = { left: 30, right: -30 };
  }

  buildUI() {
    // Score display
    this.scoreText = this.add.text(512, 60, '0', {
      fontSize: '48px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // Lives display
    this.livesText = this.add.text(80, 60, 'Hearts: 3', {
      fontSize: '28px', color: '#ff6b9d', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // High score
    const highScore = parseInt(localStorage.getItem('earkandi_highscore') || '0');
    this.highScoreText = this.add.text(944, 60, `HI: ${highScore}`, {
      fontSize: '24px', color: '#0ff0fc', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // Launch power indicator
    this.powerBarBg = this.add.rectangle(968, 580, 24, 200, 0x2a2a4a)
      .setStrokeStyle(2, 0x3a3a6a);

    this.powerBarFill = this.add.rectangle(968, 680, 20, 10, 0x57fb88)
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
        this.ball.setVelocityX(-30);
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
      const leftBtn = this.add.image(150, 700, 'btn-flip-left')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      leftBtn.on('pointerdown', onLeftFlipperDown);
      leftBtn.on('pointerup', onLeftFlipperUp);
      leftBtn.on('pointerout', onLeftFlipperUp);

      const rightBtn = this.add.image(874, 700, 'btn-flip-right')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.6);

      rightBtn.on('pointerdown', onRightFlipperDown);
      rightBtn.on('pointerup', onRightFlipperUp);
      rightBtn.on('pointerout', onRightFlipperUp);

      const launchBtn = this.add.image(968, 680, 'btn-launch')
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
          this.ball.setVelocityX(-30);
        }
      });
    }
  }

  spawnBall() {
    this.ball = this.physics.add.sprite(968, 700, 'ball');
    this.ball.setCollideWorldBounds(false);
    this.ball.setBounce(0.4);
    this.ball.setCircle(16);
    this.ball.body.setAllowGravity(true);

    // Collide ball with walls
    this.physics.add.collider(this.ball, this.walls);

    // Bumper collision — adds score and plays effects
    this.physics.add.collider(this.ball, this.bumpers, (ball, bumper) => {
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

    this.ballLaunched = false;
    this.launchPower = 0;
    this.isCharging = false;
  }

  update(time, delta) {
    // Launch charging
    if (!this.ballLaunched && this.isCharging) {
      this.launchPower = Math.min(1000, this.launchPower + delta * 0.7);

      // Ball rises in launch lane as power builds
      this.ball.y = 700 - this.launchPower * 0.3;

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
      this.powerBarHeight = 10;
      this.powerBarFill.setScale(1, 1);
      this.powerBarFill.setFillStyle(0x57fb88);
    }

    // Check if ball has drained
    if (this.ball && this.ball.y > 800) {
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
        if (distL < 80 && this.ball.y > 650 && this.ball.y < 730) {
          this.ball.setVelocityY(-400);
          this.ball.setVelocityX(-200);
        }
      }

      // Right flipper
      if (this.isFlipperActive(this.rightFlipper, this.flipperActiveAngle.right)) {
        const distR = Phaser.Math.Distance.Between(
          this.ball.x, this.ball.y,
          this.rightFlipper.x, this.rightFlipper.y
        );
        if (distR < 80 && this.ball.y > 650 && this.ball.y < 730) {
          this.ball.setVelocityY(-400);
          this.ball.setVelocityX(200);
        }
      }
    }
  }

  isFlipperActive(flipper, activeAngle) {
    return Math.abs(flipper.angle - activeAngle) < 5;
  }

  updateScoreDisplay() {
    this.scoreText.setText(this.score.toString());
  }

  updateLivesDisplay() {
    this.livesText.setText(`Hearts: ${this.lives}`);
  }

  loseLife() {
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
