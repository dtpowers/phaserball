import Phaser from 'phaser';

const BPM = 110;
const BEAT_MS = 60000 / BPM; // ~545ms

export class MusicScene extends Phaser.Scene {
  constructor() { super('MusicScene'); }

  create() {
    this.time.addEvent({
      delay: BEAT_MS,
      loop: true,
      callback: this._onBeat,
      callbackScope: this
    });
  }

  _onBeat() {
    this.sound.play('kick');
    this.game.events.emit('beat', { interval: BEAT_MS });
  }
}
