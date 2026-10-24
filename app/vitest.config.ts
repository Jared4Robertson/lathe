import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests run in jsdom without the Lathe API plugin; they build workspaces in memory.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'], maxWorkers: 2 },
});
