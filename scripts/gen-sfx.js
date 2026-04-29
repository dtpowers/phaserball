// scripts/gen-sfx.js — generates simple WAV SFX files
import fs from 'fs';

function writeWav(filename, frequency, duration, type = 'sine') {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const envelope = 1 - i / numSamples;

    if (type === 'sine') {
      sample = Math.sin(2 * Math.PI * frequency * t) * envelope;
    } else if (type === 'noise') {
      sample = (Math.random() * 2 - 1) * envelope * 0.3;
    }

    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, sample * 32767)), 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
}

fs.mkdirSync('public/assets/sfx', { recursive: true });

// Bumper hit — bright ping
writeWav('public/assets/sfx/bumper-hit.mp3', 880, 0.15, 'sine');
// Flipper activate — short click
writeWav('public/assets/sfx/flipper-activate.mp3', 440, 0.08, 'sine');
// Ball drain — descending tone
writeWav('public/assets/sfx/ball-drain.mp3', 220, 0.5, 'sine');

console.log('SFX generated');
