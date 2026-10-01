import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',

      manifest: false,

      includeAssets: [
        'apple-touch-icon.png',
        'icon-192x192.png',
        'icon-512x512.png',
        'icon-maskable-512x512.png',
        'PlaceHub.png',
      ],

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webp,woff,woff2,webmanifest}',
        ],

        cleanupOutdatedCaches: true,

        runtimeCaching: [],

        navigateFallback: 'index.html',
        
        // Import our isolated push notification script safely
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
});