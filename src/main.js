import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: 700,
  height: 1050,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: {
        y: 1
      },
      enableSleeping: false,
      setBounds: false
    }
  },
  scene: [BootScene, GameScene, GameOverScene],
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 3
  },
  disableContextMenu: true
};

const game = new Phaser.Game(config);
