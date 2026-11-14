import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'async-css',
      transformIndexHtml(html) {
        return html.replace(
          /<link rel="stylesheet"(\s+crossorigin)?(\s+href="\/assets\/[^"]+\.css")([^>]*)>/g,
          '<link rel="stylesheet"$1$2$3 media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet"$1$2$3></noscript>'
        );
      },
    },
  ],
  base: '/',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
    modulePreload: {
      resolveDependencies(_filename, deps) {
        // Don't contend with LCP image/fonts for seo-vendor on first paint
        return deps.filter((dep) => !dep.includes('seo-vendor'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('@turf')) {
            return 'map-vendor';
          }
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
            return 'react-vendor';
          }
          if (id.includes('react-helmet-async')) {
            return 'seo-vendor';
          }
        },
      },
    },
  },
});
