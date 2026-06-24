import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MusicScene } from './scenes/MusicScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { installAudioLimiter } from './audio-limiter.js';

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
  physics: false,
  scene: [BootScene, MusicScene, GameScene, GameOverScene],
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    activePointers: 3
  },
  disableContextMenu: true
};

const game = new Phaser.Game(config);
window.phaserGame = game;

// Insert a master-bus limiter so overlapping SFX never hard-clip the output.
installAudioLimiter(game);
