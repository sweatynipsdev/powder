import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works at any path (GitHub Pages serves it under /powder/).
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Powder',
        short_name: 'Powder',
        description: 'Snow forecasts and daily analysis for my resorts',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Forecast data isn't precached: it's fetched network-first and cached at runtime,
        // so the app always tries for fresh data and falls back to the last copy offline.
        globIgnores: ['data/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Same origin only: Caltrans cam stills also live under a /data/ path, and the cam
            // viewer reloads them every minute, which would push resort data out of the cache.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'powder-data',
              networkTimeoutSeconds: 4,
              // data.json plus one file per resort (41), with room to grow.
              expiration: { maxEntries: 60 },
            },
          },
        ],
      },
    }),
  ],
});
