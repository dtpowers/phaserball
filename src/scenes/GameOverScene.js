import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    const { score, highScore } = data;

    // Dark overlay
    this.add.rectangle(350, 525, 700, 1050, 0x1a1a2e, 0.95);

    // Title
    this.add.text(350, 150, 'GAME OVER', {
      fontSize: '72px', color: '#e94560', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);

    // Decorative shapes — non-overlapping spawn with bounce physics
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    const minDist = 60;
    const collisionRadius = 25;
    this.decShapes = [];

    for (let i = 0; i < 8; i++) {
      let x, y, valid;
      let attempts = 0;

      do {
        x = Phaser.Math.Between(40, 660);
        y = Phaser.Math.Between(40, 1000);
        valid = true;

        for (const s of this.decShapes) {
          const dx = s.sprite.x - x;
          const dy = s.sprite.y - y;
          if (Math.sqrt(dx * dx + dy * dy) < minDist) {
            valid = false;
            break;
          }
        }
        attempts++;
      } while (!valid && attempts < 200);

      const sprite = this.add.image(x, y, shapes[i % shapes.length])
        .setScale(0.5)
        .setAlpha(0.3);

      sprite.decVelX = Phaser.Math.FloatBetween(-20, 20) / 60;
      sprite.decVelY = Phaser.Math.FloatBetween(-20, 20) / 60;
      sprite.decAngVel = Phaser.Math.FloatBetween(-15, 15) / 60;
      sprite.decCollisionR = collisionRadius;

      this.decShapes.push({ sprite });
    }

    // Score
    this.add.text(350, 280, 'SCORE', {
      fontSize: '32px', color: '#888888', fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(350, 340, score.toString(), {
      fontSize: '64px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // High Score
    const isNewHigh = score >= highScore;
    if (isNewHigh) {
      this.add.text(350, 420, 'NEW HIGH SCORE!', {
        fontSize: '36px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);

      const hsText = this.add.text(350, 470, highScore.toString(), {
        fontSize: '56px', color: '#ffe066', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);

      this.tweens.add({
        targets: hsText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      this.add.text(350, 430, `HIGH SCORE: ${highScore}`, {
        fontSize: '32px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);
    }

    // Restart button
    const restartBtn = this.add.text(350, 600, 'PLAY AGAIN', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'Arial',
      backgroundColor: '#e94560', padding: { x: 40, y: 20 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setScale(1.1));
    restartBtn.on('pointerout', () => restartBtn.setScale(1.0));
    restartBtn.on('pointerdown', () => {
      // Phaser docs: "If the Scene is paused, it will be shutdown and then started."
      // GameScene is paused (not stopped), so start() triggers the full lifecycle:
      // shutdown() -> init() -> create() -> start().
      this.scene.stop('GameOverScene');
      this.scene.start('GameScene');
    });
  }

  update() {
    const bounds = { minX: 40, maxX: 660, minY: 40, maxY: 1000 };

    for (const { sprite } of this.decShapes) {
      sprite.x += sprite.decVelX;
      sprite.y += sprite.decVelY;
      sprite.angle += sprite.decAngVel;

      if (sprite.x < bounds.minX) { sprite.x = bounds.minX; sprite.decVelX *= -1; }
      if (sprite.x > bounds.maxX) { sprite.x = bounds.maxX; sprite.decVelX *= -1; }
      if (sprite.y < bounds.minY) { sprite.y = bounds.minY; sprite.decVelY *= -1; }
      if (sprite.y > bounds.maxY) { sprite.y = bounds.maxY; sprite.decVelY *= -1; }
    }

    for (let i = 0; i < this.decShapes.length; i++) {
      for (let j = i + 1; j < this.decShapes.length; j++) {
        const a = this.decShapes[i].sprite;
        const b = this.decShapes[j].sprite;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minD = a.decCollisionR + b.decCollisionR;

        if (distSq < minD * minD && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const overlap = minD - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const dvx = a.decVelX - b.decVelX;
          const dvy = a.decVelY - b.decVelY;
          const dvDotN = dvx * nx + dvy * ny;

          if (dvDotN > 0) {
            a.decVelX -= dvDotN * nx;
            a.decVelY -= dvDotN * ny;
            b.decVelX += dvDotN * nx;
            b.decVelY += dvDotN * ny;
          }
        }
      }
    }
  }
}
