// Master-bus brick-wall limiter to prevent audio clipping when multiple SFX
// (kick, hihat on every bumper hit, flipper, drain) sum past 0 dBFS at once.
//
// Phaser's WebAudioSoundManager graph is:
//   sound source -> masterMuteNode -> masterVolumeNode -> context.destination
// We splice a DynamicsCompressorNode (configured as a limiter) between
// masterVolumeNode and the context destination, so EVERYTHING the game plays
// passes through it on the way out. This is transparent to per-sound code.
//
// A compressor with ratio 20 + knee 0 + fast attack behaves as a brick-wall
// limiter: it clamps peaks to ~threshold instead of letting them clip.

const LIMITER = {
  threshold: -3,  // dB — start clamping just below full scale
  knee: 0,        // hard knee → true limiter, not a soft compressor
  ratio: 20,      // max ratio → brick wall
  attack: 0.003,  // 3 ms — catch transients fast
  release: 0.25   // 250 ms — smooth recovery, no pumping
};

// Slight headroom: pull the master down a touch so summed sounds land below
// 0 dBFS most of the time and the limiter only catches the loud overlaps.
const MASTER_HEADROOM = 0.8;

export function installAudioLimiter(game) {
  const manager = game.sound;

  // Only the Web Audio backend exposes the node graph. HTML5/NoAudio managers
  // have no context — nothing to protect, so bail quietly.
  const ctx = manager && manager.context;
  if (!ctx || !manager.masterVolumeNode) return;

  // Guard against double-install (e.g. hot reload).
  if (manager._limiterInstalled) return;
  manager._limiterInstalled = true;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;

  // Re-route: masterVolumeNode -> limiter -> destination.
  manager.masterVolumeNode.disconnect();
  manager.masterVolumeNode.connect(limiter);
  limiter.connect(ctx.destination);

  // Leave a little headroom so the limiter is a safety net, not always-on.
  manager.setVolume(manager.volume * MASTER_HEADROOM);

  // Keep a handle for debugging / future tuning.
  manager._limiterNode = limiter;
}
