import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workspaceSavePlugin } from './vite-plugin-workspace-save';

export default defineConfig({
  plugins: [
    react(),
    workspaceSavePlugin(),
  ],
  server: {
    port: 48088,
    strictPort: true,
    host: true
  },
  preview: {
    port: 48088,
    strictPort: true,
    host: true
  }
});


