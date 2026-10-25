import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { latheApi } from './server/lathe.ts';

// The product repo Lathe reads: LATHE_ROOT, or this repo (Lathe dogfooding itself).
const root = process.env.LATHE_ROOT ?? fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react(), latheApi(root)],
  // The record format page imports lathe/FORMAT.md, which sits outside app/.
  server: { port: 5199, strictPort: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  // `npm --prefix lathe run build` builds the app into the package, for `lathe serve`.
  build: { outDir: fileURLToPath(new URL('../lathe/dist/app', import.meta.url)), emptyOutDir: true },
});
