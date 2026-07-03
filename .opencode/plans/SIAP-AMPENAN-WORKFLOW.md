# SIAP Puskesmas Ampenan — Workflow & CI/CD

## GitHub Actions Build APK & Deploy
File: `.github/workflows/build.yml`
Trigger: push ke `main` (atau manual via `workflow_dispatch`)

Steps:
1. Setup Java 17 + Android SDK + Node.js 20
2. `npm ci` + `npm run build`
3. `npx cap sync android`
4. `./gradlew assembleDebug` → APK debug (signed)
5. Upload APK sebagai artifact
6. Copy APK ke `public/SIAP-Puskesmas.apk`
7. `npx vercel --prod` → deploy web + APK

## GitHub Secrets (sudah diset)
- `VERCEL_TOKEN` — token API Vercel
- `VERCEL_ORG_ID` — `team_BCr1woCZQlnCMZSiBFSDvvvZ`
- `VERCEL_PROJECT_ID` — `prj_84vgo4pxNHkRHpt8nhD7ELVefCx7`

## Alur Update
```
Push ke main (laptop kantor/rumah)
  → GitHub Actions build APK otomatis
  → APK bisa download dari Actions tab
  → Web + APK deploy ke Vercel
  → User HP buka app → dialog force update → download APK baru
```

## Development
- Laptop kantor/rumah: `git push` → workflow otomatis
- Testing lokal: `npm run dev`
- Build APK manual: `npm run build` → `npx cap sync` → Android Studio

## Perbaikan Kamera Android APK (v1.2.1, commit 0971e85)
1. Hapus `setShowNativeFallback(true)` yang undefined di `runDetection()`
2. Nonaktifkan `pageshow`/`visibilitychange` reload untuk Capacitor native
3. Platform-aware `DETECTION_INTERVAL`: 150ms web, 300ms Android
4. Tambah tombol "Ambil Foto Manual" sebagai fallback
5. Install `@capacitor/camera` → fallback camera native Android
6. `apkUrl` di version.json diubah ke URL absolut untuk bisa di-download dari APK
