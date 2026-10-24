import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modelApi } from './server/model';
import { specApi } from './server/spec';

const modelDir = fileURLToPath(new URL('../model', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react(), modelApi(modelDir), specApi(repoRoot)],
  server: { port: 5199, strictPort: true },
});
