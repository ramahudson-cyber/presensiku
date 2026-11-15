const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ============================================================
// Generator icon Presensiku — logo FINGERPRINT (sidik jari), TANPA TEKS.
// Satu sumber kebenaran untuk icon PWA (web) & launcher APK (Android).
//
// Desain mengikuti ikon FAB "Presensi" (FingerprintPattern, lucide) di
// bottom nav: alur fingerprint putih di atas gradient hero biru.
// ============================================================

// Gradient hero resmi DESIGN.md (senada welcome & dashboard)
const BG_STOPS = [
  ['#39C0DF', '0%'],
  ['#32ACFB', '30%'],
  ['#3F93FD', '62%'],
  ['#4A7CFB', '100%'],
];
const BG_DEEP = '#3F93FD'; // warna latar adaptive icon (tengah gradient)

// Path alur fingerprint — persis ikon FingerprintPattern (lucide v1.18),
// digambar di viewBox 24 lalu diskalakan ke kanvas icon.
const FP_PATHS = [
  'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
  'M14 13.12c0 2.38 0 6.38-1 8.88',
  'M17.29 21.02c.12-.6.43-2.3.5-3.02',
  'M2 12a10 10 0 0 1 18-6',
  'M2 16h.01',
  'M21.8 16c.2-2 .131-5.354 0-6',
  'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
  'M8.65 22c.21-.66.45-1.32.57-2',
  'M9 6.8a6 6 0 0 1 9 5.2v2',
];

// Ukuran area aman untuk maskable/adaptive icon: fingerprint dikecilkan agar
// tak terpotong saat di-mask bulat/squircle oleh sistem.
// Skala dihitung di ruang viewBox 24 (alur fingerprint): 24 × 4 = 96 px
// dari kanvas 120 (80%) untuk full-bleed; 24 × 3 = 72 px (60%) maskable.
const PIN_SCALE_NORMAL = 4.0; // full-bleed icon (favicon, apple-touch, launcher legacy)
const PIN_SCALE_MASKABLE = 3.0; // area aman adaptive/maskable (PWA)
// Adaptive Android: foreground 108dp, konten aman ~66dp (≈73 px di ruang 120).
const PIN_SCALE_FOREGROUND = 3.05;

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
 * Alur fingerprint saja (tanpa latar), digambar di dalam viewBox 120x120.
 * `scale` mengecilkan fingerprint dari pusat untuk keperluan maskable.
 * Ikon = FingerprintPattern (lucide v1.18): 24 unit × scale 5 = 120 penuh.
 */
function fpGroup(scale) {
  const t = `translate(60 60) scale(${scale}) translate(-12 -12.5)`;
  const paths = FP_PATHS.map(
    (d) => `    <path d="${d}" stroke="#FFFFFF" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" />`
  ).join('\n');
  return `
  <g transform="${t}" fill="none">
${paths}
  </g>`;
}

/** SVG lengkap dengan latar (full-bleed, sudut membulat untuk PWA). */
function getIconSvg(size, { maskable = false, rounded = true } = {}) {
  const scale = maskable ? PIN_SCALE_MASKABLE : PIN_SCALE_NORMAL;
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const stops = BG_STOPS.map(([c, o]) => `      <stop offset="${o}" stop-color="${c}"/>`).join('\n');
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="70%" y2="100%">
${stops}
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <svg x="0" y="0" width="${size}" height="${size}" viewBox="0 0 120 120">${fpGroup(scale)}</svg>
</svg>`);
}

/** Isi fingerprint saja (untuk foreground adaptive Android) di viewport 108. */
function getPinOnlySvg(size) {
  const scale = PIN_SCALE_FOREGROUND;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 108 108"
    xmlns="http://www.w3.org/2000/svg">
  <svg x="0" y="0" width="108" height="108" viewBox="0 0 120 120">${fpGroup(scale)}</svg>
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
    <color name="ic_launcher_background">${BG_DEEP}</color>
</resources>
`);
  console.log('  values/ic_launcher_background.xml -> ' + BG_DEEP);

  // Vector drawable fingerprint (BUKAN adaptive-icon; adaptive-icon hanya di
  // mipmap-anydpi-v26). Alur = FingerprintPattern (24 unit) diskalakan 3.4
  // ke viewport 120, dipusatkan (120 - 24*3.4) / 2 = 19.2.
  const scale = 3.4;
  const offset = (120 - 24 * scale) / 2;
  const fpPaths = FP_PATHS.map(
    (d) => `    <path
        android:pathData="${d}"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="2"
        android:strokeLineJoin="round"
        android:strokeLineCap="round" />`
  ).join('\n');
  const fgVector = `<?xml version="1.0" encoding="utf-8"?>
<!-- Vector drawable fingerprint (BUKAN adaptive-icon; adaptive-icon hanya di mipmap-anydpi-v26).
     File ini tidak direferensikan langsung (adaptive icon memakai @mipmap/ic_launcher_foreground),
     dipertahankan sebagai vector valid agar tidak memicu kegagalan linking resource. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="120"
    android:viewportHeight="120">
    <group
        android:translateX="${offset}"
        android:translateY="${offset}"
        android:scaleX="${scale}"
        android:scaleY="${scale}">
${fpPaths}
    </group>
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
  console.log('Generating Android icons (fingerprint, no text)...');
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
