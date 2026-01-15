
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // base: './', // Removed to fix absolute path resolution issues in some environments
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: {
        enabled: false, // Keep disabled in dev to prevent errors
        type: 'module',
      },
      manifest: {
        name: "FHB Maintain",
        short_name: "FHB Maintain",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
          {
            src: "https://cdn-icons-png.flaticon.com/512/993/993891.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "https://cdn-icons-png.flaticon.com/512/993/993891.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
  }
});
