import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modelApi } from './server/model';

const modelDir = fileURLToPath(new URL('../model', import.meta.url));

export default defineConfig({
  plugins: [react(), modelApi(modelDir)],
  server: { port: 5199, strictPort: true },
});
