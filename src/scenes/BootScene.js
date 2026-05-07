import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Audio only — visuals are generated procedurally
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.wav');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.wav');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.wav');
  }

  create() {
    this.generateAssets();
    this.scene.start('GameScene');
  }

  generateAssets() {
    const g = this.make.graphics();

    // Ball — white circle with subtle edge
    g.clear();
    g.fillStyle(0xffffff);
    g.fillCircle(16, 16, 16);
    g.lineStyle(2, 0xcccccc);
    g.strokeCircle(16, 16, 16);
    g.generateTexture('ball', 32, 32);

    // Star bumper — neon yellow
    g.clear();
    this.drawStar(g, 40, 40, 5, 36, 18);
    g.fillStyle(0xffe066);
    g.fill();
    g.lineStyle(3, 0xffcc00);
    g.stroke();
    g.fillStyle(0xffe066, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-star', 80, 80);

    // Moon bumper — neon purple
    g.clear();
    this.drawMoon(g, 40, 40, 36);
    g.fillStyle(0xc77dff);
    g.fill();
    g.lineStyle(3, 0x9d4edd);
    g.stroke();
    g.fillStyle(0xc77dff, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-moon', 80, 80);

    // Heart bumper — neon pink
    g.clear();
    this.drawHeart(g, 40, 40, 36);
    g.fillStyle(0xff6b9d);
    g.fill();
    g.lineStyle(3, 0xe94560);
    g.stroke();
    g.fillStyle(0xff6b9d, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-heart', 80, 80);

    // Flower bumper — neon green
    g.clear();
    this.drawFlower(g, 40, 40, 36);
    g.fillStyle(0x57fb88);
    g.fill();
    g.lineStyle(3, 0x00f5a0);
    g.stroke();
    g.fillStyle(0x57fb88, 0.3);
    g.fillCircle(40, 40, 50);
    g.generateTexture('bumper-flower', 80, 80);

    // Wall segment — thin line
    g.clear();
    g.fillStyle(0x3a3a6a);
    g.fillRect(0, 0, 4, 32);
    g.generateTexture('wall', 4, 32);

    // Flipper — rounded rectangle, neon blue
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    g.fillRoundedRect(0, 0, 156, 28, 14);
    g.strokeRoundedRect(0, 0, 156, 28, 14);
    g.generateTexture('flipper', 156, 28);

    // UI button - LEFT (with left-pointing arrow)
    g.clear();
    g.fillStyle(0x00b4d8, 0.4);
    g.lineStyle(3, 0x00f5ff);
    g.fillRoundedRect(0, 0, 120, 120, 20);
    g.strokeRoundedRect(0, 0, 120, 120, 20);
    // Arrow pointing left
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(85, 60);
    g.lineTo(35, 35);
    g.lineTo(35, 50);
    g.lineTo(55, 50);
    g.lineTo(55, 70);
    g.lineTo(35, 70);
    g.lineTo(35, 85);
    g.closePath();
    g.fill();
    g.generateTexture('btn-flip-left', 120, 120);

    // UI button - RIGHT (with right-pointing arrow)
    g.clear();
    g.fillStyle(0x00b4d8, 0.4);
    g.lineStyle(3, 0x00f5ff);
    g.fillRoundedRect(0, 0, 120, 120, 20);
    g.strokeRoundedRect(0, 0, 120, 120, 20);
    // Arrow pointing right
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(35, 60);
    g.lineTo(85, 35);
    g.lineTo(85, 50);
    g.lineTo(65, 50);
    g.lineTo(65, 70);
    g.lineTo(85, 70);
    g.lineTo(85, 85);
    g.closePath();
    g.fill();
    g.generateTexture('btn-flip-right', 120, 120);

    // UI button - LAUNCH (with up-pointing arrow)
    g.clear();
    g.fillStyle(0xe94560, 0.5);
    g.lineStyle(3, 0xff6b9d);
    g.fillRoundedRect(0, 0, 100, 180, 20);
    g.strokeRoundedRect(0, 0, 100, 180, 20);
    // Arrow pointing up
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(50, 50);
    g.lineTo(70, 90);
    g.lineTo(55, 90);
    g.lineTo(55, 120);
    g.lineTo(45, 120);
    g.lineTo(45, 90);
    g.lineTo(30, 90);
    g.closePath();
    g.fill();
    g.generateTexture('btn-launch', 100, 180);

    g.destroy();
  }

  drawStar(g, cx, cy, points, outerR, innerR) {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  drawMoon(g, cx, cy, r) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.moveTo(cx + r * 0.6, cy - r * 0.7);
    g.arc(cx + r * 0.6, cy - r * 0.1, r * 0.8, 0, Math.PI * 2);
    g.closePath();
  }

  drawHeart(g, cx, cy, size) {
    const r = size * 0.5;
    g.beginPath();
    // Start at bottom point, trace up the left side using an arc
    g.moveTo(cx, cy + r * 1.6);
    // Left arc (upper half of left circle)
    g.arc(cx - r * 0.5, cy - r * 0.1, r * 0.7, Math.PI * 0.5, Math.PI * 1.5, false);
    // Right arc (upper half of right circle)
    g.arc(cx + r * 0.5, cy - r * 0.1, r * 0.7, Math.PI * 1.5, Math.PI * 0.5, false);
    // Back to bottom point
    g.lineTo(cx, cy + r * 1.6);
    g.closePath();
  }

  drawFlower(g, cx, cy, r) {
    const petals = 6;
    g.beginPath();
    for (let i = 0; i < petals; i++) {
      const angle = (Math.PI * 2 / petals) * i;
      const px = cx + r * 0.5 * Math.cos(angle);
      const py = cy + r * 0.5 * Math.sin(angle);
      g.arc(px, py, r * 0.55, 0, Math.PI * 2);
    }
    g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    g.closePath();
  }
}
