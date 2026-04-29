import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  preload() {}

  create(data) {
    const { score, highScore } = data;

    // Dark overlay
    this.add.rectangle(512, 384, 1024, 768, 0x1a1a2e, 0.95);

    // Title
    this.add.text(512, 180, 'GAME OVER', {
      fontSize: '72px', color: '#e94560', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);

    // Decorative shapes
    const shapes = ['bumper-star', 'bumper-moon', 'bumper-heart', 'bumper-flower'];
    for (let i = 0; i < 8; i++) {
      const shape = this.add.image(
        Phaser.Math.Between(100, 924),
        Phaser.Math.Between(100, 668),
        shapes[i % shapes.length]
      ).setScale(0.5).setAlpha(0.3);

      this.tweens.add({
        targets: shape,
        angle: shape.angle + 360,
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1,
        ease: 'Linear'
      });
    }

    // Score
    this.add.text(512, 310, 'SCORE', {
      fontSize: '32px', color: '#888888', fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(512, 370, score.toString(), {
      fontSize: '64px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // High Score
    const isNewHigh = score >= highScore;
    if (isNewHigh) {
      this.add.text(512, 450, 'NEW HIGH SCORE!', {
        fontSize: '36px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);

      const hsText = this.add.text(512, 500, highScore.toString(), {
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
      this.add.text(512, 460, `HIGH SCORE: ${highScore}`, {
        fontSize: '32px', color: '#0ff0fc', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);
    }

    // Restart button
    const restartBtn = this.add.text(512, 620, 'PLAY AGAIN', {
      fontSize: '44px', color: '#ffffff', fontFamily: 'Arial',
      backgroundColor: '#e94560', padding: { x: 40, y: 20 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setScale(1.1));
    restartBtn.on('pointerout', () => restartBtn.setScale(1.0));
    restartBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
