import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Audio
    this.load.audio('bumper-hit', 'assets/sfx/bumper-hit.wav');
    this.load.audio('flipper-activate', 'assets/sfx/flipper-activate.wav');
    this.load.audio('ball-drain', 'assets/sfx/ball-drain.wav');
    this.load.audio('kick', 'assets/sfx/kick.wav');
    this.load.audio('hihat', 'assets/sfx/hihat.wav');
    // Custom bumper sprites (250x250 PNG, transparent background)
    this.load.image('bumper-star', 'assets/images/star.png');
    this.load.image('bumper-heart', 'assets/images/heart.png');
    this.load.image('bumper-moon', 'assets/images/moon.png');
    this.load.image('bumper-flower', 'assets/images/flower.png');
    this.load.image('bumper-angle', 'assets/images/angleBump.png');
    // Flipper sprite
    this.load.image('flipper', 'assets/images/flipper.png');
  }

  create() {
    this.generateAssets();
    this.scene.launch('MusicScene');
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
