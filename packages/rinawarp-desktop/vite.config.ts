import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: 'electron/main.ts',
      vite: {
        build: {
          outDir: 'dist/electron'
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist/app',
    emptyOutDir: true
  }
});
