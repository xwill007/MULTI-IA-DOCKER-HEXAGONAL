import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true, // Para Docker en Windows
      interval: 100
    },
    hmr: {
      overlay: true
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  optimizeDeps: {
    force: true // Forzar re-optimización en desarrollo
  }
});
