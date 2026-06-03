// scripts/clean-sprites.js — removes white fringe from bumper sprites via alpha erosion
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../public/assets/images');
const sprites = ['star.png', 'heart.png', 'moon.png', 'flower.png'];

// Erode alpha channel by radius pixels (minimum-filter over neighborhood).
// This shrinks the opaque region, cutting the semi-transparent white fringe.
function erodeAlpha(data, width, height, channels, radius) {
  const output = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      let minAlpha = data[idx + 3];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            minAlpha = Math.min(minAlpha, data[(ny * width + nx) * channels + 3]);
          }
        }
      }
      output[idx + 3] = minAlpha;
    }
  }
  return output;
}

// For semi-transparent edge pixels, remove white color bias introduced by
// anti-aliasing against a white background. Formula: un-premultiply from white.
function defringe(data, width, height, channels) {
  const output = Buffer.from(data);
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a === 0 || a === 255) continue;
    const af = a / 255;
    for (let c = 0; c < 3; c++) {
      // Reverse: composited = af * color + (1-af) * 255
      // color = (composited - (1-af)*255) / af
      const raw = (data[i + c] - (1 - af) * 255) / af;
      output[i + c] = Math.max(0, Math.min(255, Math.round(raw)));
    }
  }
  return output;
}

async function processSprite(filename) {
  const inputPath = path.join(imagesDir, filename);

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  let processed = defringe(data, width, height, channels);
  processed = erodeAlpha(processed, width, height, channels, 2);

  await sharp(processed, { raw: { width, height, channels } })
    .png()
    .toFile(inputPath);

  console.log(`Cleaned: ${filename}`);
}

for (const sprite of sprites) {
  await processSprite(sprite);
}
console.log('Done.');
