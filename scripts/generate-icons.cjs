const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ============================================================
// Generator icon Presensiku — logo TITIK LOKASI (pin), TANPA TEKS.
// Satu sumber kebenaran untuk icon PWA (web) & launcher APK (Android).
//
// Desain mengikuti pin di hero WelcomePage:
//   badan pin bergaris + ring dalam + inti bercahaya, di atas latar
//   gradien ungu (senada tema app).
// ============================================================

// Gradien latar ungu (senada icon lama #BF00FF -> #660099)
const BG_FROM = '#BF00FF';
const BG_TO = '#660099';

// Ukuran area aman untuk maskable/adaptive icon: pin dikecilkan agar
// tak terpotong saat di-mask bulat/squircle oleh sistem.
const PIN_SCALE_NORMAL = 0.82; // full-bleed icon (favicon, apple-touch, launcher legacy)
const PIN_SCALE_MASKABLE = 0.72; // area aman adaptive/maskable (PWA)
// Adaptive Android: foreground 108dp, konten aman ~66dp. Pin di viewBox 120
// diskalakan agar mengisi area aman dengan pas.
const PIN_SCALE_FOREGROUND = 0.78;

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

/**
 * Isi pin saja (tanpa latar), digambar di dalam viewBox 120x120.
 * `scale` mengecilkan pin dari pusat untuk keperluan maskable.
 */
function pinGroup(scale) {
  const t = `translate(60 60) scale(${scale}) translate(-60 -60)`;
  return `
  <g transform="${t}">
    <!-- Ripple/lingkaran sonar samar di pusat pin -->
    <ellipse cx="60" cy="66" rx="40" ry="27" fill="none"
             stroke="rgba(255,255,255,0.18)" stroke-width="2.5" />
    <ellipse cx="60" cy="66" rx="30" ry="20" fill="none"
             stroke="rgba(255,255,255,0.28)" stroke-width="2.5" />

    <!-- Badan pin (garis putih) -->
    <path d="M60 10 C38 10 22 26 22 46 C22 66 43 92 60 106 C77 92 98 66 98 46 C98 26 82 10 60 10 Z"
          fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />

    <!-- Ring dalam -->
    <circle cx="60" cy="46" r="26" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="4" />

    <!-- Inti bercahaya -->
    <circle cx="60" cy="46" r="17" fill="#FFFFFF" opacity="0.22" />
    <circle cx="60" cy="46" r="11" fill="#FFFFFF" opacity="0.55" />
    <circle cx="60" cy="46" r="5"  fill="#FFFFFF" />
  </g>`;
}

/** SVG lengkap dengan latar (full-bleed, sudut membulat untuk PWA). */
function getIconSvg(size, { maskable = false, rounded = true } = {}) {
  const scale = maskable ? PIN_SCALE_MASKABLE : PIN_SCALE_NORMAL;
  const radius = rounded ? Math.round(size * 0.22) : 0;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG_FROM}"/>
      <stop offset="100%" stop-color="${BG_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <svg x="0" y="0" width="${size}" height="${size}" viewBox="0 0 120 120">${pinGroup(scale)}</svg>
</svg>`);
}

/** Isi pin saja (untuk foreground adaptive Android) di viewport 108. */
function getPinOnlySvg(size) {
  const scale = PIN_SCALE_FOREGROUND;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 108 108"
    xmlns="http://www.w3.org/2000/svg">
  <svg x="0" y="0" width="108" height="108" viewBox="0 0 120 120">${pinGroup(scale)}</svg>
</svg>`);
}

async function generateAndroidIcons() {
  for (const [dir, size] of Object.entries(SIZES)) {
    const outDir = path.join(ANDROID_RES, dir);
    const svg = getIconSvg(size);
    await sharp(svg).png().toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(svg).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    // Foreground adaptive: pin saja tanpa latar (latar dari warna).
    const fg = getPinOnlySvg(size * 2);
    await sharp(fg).png().toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    console.log(`  ${dir} (${size}x${size})`);
  }
}

async function generateAdaptiveIcons() {
  const valuesPath = path.join(ANDROID_RES, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(valuesPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG_TO}</color>
</resources>
`);
  console.log('  values/ic_launcher_background.xml -> ' + BG_TO);

  const fgVector = `<?xml version="1.0" encoding="utf-8"?>
<!-- Vector drawable pin (BUKAN adaptive-icon; adaptive-icon hanya di mipmap-anydpi-v26).
     File ini tidak direferensikan langsung (adaptive icon memakai @mipmap/ic_launcher_foreground),
     dipertahankan sebagai vector valid agar tidak memicu kegagalan linking resource. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="120"
    android:viewportHeight="120">
    <path
        android:pathData="M60,10 C38,10 22,26 22,46 C22,66 43,92 60,106 C77,92 98,66 98,46 C98,26 82,10 60,10 Z"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="6"
        android:strokeLineJoin="round"
        android:strokeLineCap="round" />
    <path
        android:pathData="M60,20 A26,26 0 1,1 59.99,20 Z"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="4" />
    <path
        android:pathData="M60,41 A5,5 0 1,1 59.99,41 Z"
        android:fillColor="#FFFFFF" />
</vector>`;
  fs.writeFileSync(
    path.join(ANDROID_RES, 'drawable-v24', 'ic_launcher_foreground.xml'),
    fgVector
  );
  console.log('  drawable-v24/ic_launcher_foreground.xml (vector) updated');
}

async function generateWebIcons() {
  for (const [name, size] of Object.entries(WEB_SIZES)) {
    const svg = getIconSvg(size, { maskable: true });
    await sharp(svg).png().toFile(path.join(PUBLIC_DIR, `${name}.png`));
    console.log(`  ${name}.png (${size}x${size})`);
  }

  const appleSvg = getIconSvg(180, { maskable: true });
  await sharp(appleSvg).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('  apple-touch-icon.png (180x180)');

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), getIconSvg(48, { maskable: true }).toString());
  console.log('  favicon.svg');

  fs.writeFileSync(path.join(PUBLIC_DIR, 'icons.svg'), getIconSvg(512, { maskable: true }).toString());
  console.log('  icons.svg');
}

async function main() {
  console.log('Generating Android icons (pin, no text)...');
  await generateAndroidIcons();

  console.log('\nGenerating adaptive icons...');
  await generateAdaptiveIcons();

  console.log('\nGenerating web icons...');
  await generateWebIcons();

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
