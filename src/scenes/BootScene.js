import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Audio
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.wav');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.wav');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.wav');
    // Custom bumper sprites (250x250 PNG, transparent background)
    this.load.image('bumper-star', 'assets/images/star.png');
    this.load.image('bumper-heart', 'assets/images/heart.png');
    this.load.image('bumper-moon', 'assets/images/moon.png');
    this.load.image('bumper-flower', 'assets/images/flower.png');
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

    // Flipper — tapered shape, wide at pivot (28px), narrow at tip (8px)
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    g.beginPath();
    // Pivot end (left, wide 28px tall) → tip end (right, 8px tall)
    g.moveTo(0, 0);
    g.lineTo(0, 28);          // pivot end bottom edge
    g.lineTo(140, 20);        // bottom taper line
    // Rounded tip corner: arc from bottom to top of the tip
    g.arc(156, 14, 4, Math.PI * 0.5, -Math.PI * 0.5, false);
    // Top taper line back to pivot
    g.lineTo(140, 8);
    g.lineTo(0, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.generateTexture('flipper', 156, 28);

    // Flipper-right — mirrored shape, wide at pivot (right), narrow at tip (left)
    g.clear();
    g.fillStyle(0x00b4d8);
    g.lineStyle(2, 0x00f5ff);
    g.beginPath();
    g.moveTo(156, 0);           // pivot end top (wide, right side)
    g.lineTo(156, 28);         // pivot end bottom edge (wide, right)
    g.lineTo(16, 20);          // bottom taper line
    g.arc(0, 14, 4, -Math.PI * 0.5, Math.PI * 0.5, true);  // rounded tip corner (left)
    g.lineTo(16, 8);           // top taper line back to pivot
    g.lineTo(156, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.generateTexture('flipper-right', 156, 28);

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
}
