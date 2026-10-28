import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { latheApi } from './server/lathe.ts';

// The product repo Lathe reads: LATHE_ROOT, or this repo (Lathe dogfooding itself, with the Tool Library its config lists).
const root = process.env.LATHE_ROOT ?? fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react(), latheApi(root)],
  // The client shares the server's types in lathe/src (contract.ts), which sits outside app/. A worktree may link
  // node_modules to another checkout's: its real folder is allowed too, or a `?url` asset in it (ELK's worker, which
  // the ERD view lays out with) comes back empty and the ERD draws nothing.
  server: { port: 5199, strictPort: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url)), realpathSync(fileURLToPath(new URL('node_modules', import.meta.url)))] } },
  // `npm --prefix lathe run build` builds the app into the package, for `lathe serve`.
  build: { outDir: fileURLToPath(new URL('../lathe/dist/app', import.meta.url)), emptyOutDir: true },
});
