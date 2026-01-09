
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
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
    allowedHosts: true,
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
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split huge PDF libraries into their own chunk
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
              return 'pdf-lib';
            }
            // Split React and core state management
            if (id.includes('react') || id.includes('react-dom') || id.includes('zustand')) {
              return 'react-vendor';
            }
            // Split Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // Everything else into vendor
            return 'vendor';
          }
        },
      },
    },
  }
});
