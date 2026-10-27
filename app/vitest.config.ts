import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component tests run in jsdom against fixture data folders; no dev server or engine is started.
export default defineConfig({
  plugins: [react()],
  // Tests import the contract types and the store, which sit outside app/.
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    // Loads the fixture data folders through the store once per run (test/fixtures/global-setup.ts).
    globalSetup: ['test/fixtures/global-setup.ts'],
    maxWorkers: 2,
  },
});
