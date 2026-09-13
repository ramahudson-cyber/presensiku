import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Registrasi manual di main.jsx (butuh updateViaCache: "none").
      injectRegister: null,
      // svg/png/ico/woff2 sudah tercakup globPatterns — jangan diulang di sini
      // supaya tidak dobel di precache manifest.
      includeAssets: ["manifest.json"],
      manifest: {
        name: "Presensiku",
        short_name: "Presensiku",
        description: "Aplikasi Presensi Pegawai",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#5B3A8E",
        orientation: "portrait",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Hanya index.html yang diprecache sebagai dokumen — file HTML lain di public/ tidak.
        globPatterns: ["index.html", "**/*.{ico,png,svg,woff2}"],
        navigateFallbackDenylist: [
          /^\/assets\//,
          /^\/api\//,
          /^\/version\.json$/,
          /^\/sw\.js$/,
          /^\/registerSW\.js$/,
        ],
        runtimeCaching: [
          // JS/CSS: NetworkFirst, tapi JANGAN pernah cache respons HTML (bisa terjadi
          // saat SPA-fallback menelan 404 aset lama) — MIME text/html bikin module gagal
          // dieksekusi = white screen permanen.
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "NetworkFirst",
            options: {
              cacheName: "js-css-runtime-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14, purgeOnQuotaError: true },
            },
          },
          // HTML: NetworkFirst
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              networkTimeoutSeconds: 5,
            },
          },
        ],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
});