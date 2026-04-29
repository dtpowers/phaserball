import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: [],
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 3
  },
  disableContextMenu: true
};

const game = new Phaser.Game(config);

