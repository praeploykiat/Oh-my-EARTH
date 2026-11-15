import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApi } from './scripts/local-api';

export default defineConfig({
  plugins: [localApi(), react()],
  base: process.env.BASE_PATH ?? '/',
  server: {
    fs: { allow: ['..'] },
  },
});
