# Mute Button — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

## Overview

Add a persistent mute toggle button to the bottom-right of the game canvas. Mutes all Phaser audio (kick drum, hi-hat, flipper, drain). State persists across page refreshes via localStorage.

## Button Element

A `<button id="mute-btn">` added inside `#game-container` in `index.html`. Shows `🔊` when unmuted, `🔇` when muted.

## Positioning

`#game-container` gets `position: relative` added to its CSS so the button can be absolutely positioned within it. Button CSS:

```css
#mute-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(26, 26, 46, 0.7);
  border: 2px solid #00f5ff;
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;
}
#mute-btn:hover  { background: rgba(0, 245, 255, 0.15); }
#mute-btn:active { background: rgba(0, 245, 255, 0.30); }
```

## Sound Control

`src/main.js` exposes the Phaser game object as `window.phaserGame` so the HTML script can access the sound manager:

```js
// at bottom of main.js, after new Phaser.Game(config)
window.phaserGame = game;
```

`window.phaserGame.sound.setMute(bool)` mutes/unmutes all audio globally.

## Toggle Logic

A `<script type="module">` block added to `index.html` (after the `main.js` script tag). Module scripts are deferred and execute in document order, so `window.phaserGame` is guaranteed to be set when this runs.

```js
const MUTE_KEY = 'earkandi_muted';
const btn = document.getElementById('mute-btn');
let muted = localStorage.getItem(MUTE_KEY) === 'true';

window.phaserGame.sound.setMute(muted);
btn.textContent = muted ? '🔇' : '🔊';

btn.addEventListener('click', () => {
  muted = !muted;
  window.phaserGame.sound.setMute(muted);
  localStorage.setItem(MUTE_KEY, String(muted));
  btn.textContent = muted ? '🔇' : '🔊';
});
```

## Persistence

localStorage key: `earkandi_muted` (`'true'` or `'false'`). Applied on every page load before the first sound can play (MusicScene's first beat fires ~545ms after load, well after the inline script runs).

## Files Changed

| File | Change |
|------|--------|
| `src/main.js` | Add `window.phaserGame = game` after game construction |
| `index.html` | Add `position: relative` to `#game-container`; add `<button id="mute-btn">`; add mute CSS; add `<script type="module">` with toggle logic |

## Out of Scope

- Per-channel volume control
- Mute icon animation
- Keyboard shortcut for mute
