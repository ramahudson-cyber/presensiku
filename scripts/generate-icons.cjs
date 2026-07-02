const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TEXT = 'SIAP';
const BG_COLOR = '#000000';
const TEXT_COLOR = '#7C3AED';
const FONT = 'Arial';

const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const WEB_SIZES = {
  'icon-192': 192,
  'icon-512': 512,
};

const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function getTextSvg(size, text) {
  const fontSize = Math.round(size * 0.45);
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
          font-family="${FONT}" font-weight="bold" font-size="${fontSize}px" fill="${TEXT_COLOR}">${text}</text>
  </svg>`);
}

async function generateAndroidIcons() {
  for (const [dir, size] of Object.entries(SIZES)) {
    const outDir = path.join(ANDROID_RES, dir);
    const svg = getTextSvg(size, TEXT);
    await sharp(svg).png().toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(svg).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    await sharp(svg).png().toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    console.log(`  ${dir} (${size}x${size})`);
  }
}

async function generateAdaptiveIcons() {
  const size = 108;
  const svg = getTextSvg(size, TEXT);
  const bgSvg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
  </svg>`);

  const fgPath = path.join(ANDROID_RES, 'drawable-v24', 'ic_launcher_foreground.xml');
  const fgContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground>
        <inset android:drawable="@drawable/ic_launcher_foreground" android:inset="25%"/>
    </foreground>
</adaptive-icon>`;

  fs.writeFileSync(fgPath, fgContent);
  console.log('  adaptive icon config updated');
}

async function generateWebIcons() {
  for (const [name, size] of Object.entries(WEB_SIZES)) {
    const svg = getTextSvg(size, TEXT);
    await sharp(svg).png().toFile(path.join(PUBLIC_DIR, `${name}.png`));
    console.log(`  ${name}.png (${size}x${size})`);
  }

  const appleSvg = getTextSvg(180, TEXT);
  await sharp(appleSvg).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('  apple-touch-icon.png (180x180)');
}

async function main() {
  console.log('Generating Android icons...');
  await generateAndroidIcons();

  console.log('\nGenerating adaptive icons...');
  await generateAdaptiveIcons();

  console.log('\nGenerating web icons...');
  await generateWebIcons();

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
