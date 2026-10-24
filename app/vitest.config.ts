import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component tests run in jsdom against fixture workspaces; no dev server or engine is started.
export default defineConfig({
  plugins: [react()],
  // Tests import lathe/FORMAT.md, the contract types and the sample fixture from outside app/.
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    maxWorkers: 2,
  },
});
