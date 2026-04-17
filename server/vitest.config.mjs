import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    setupFiles: ['./__tests__/setup.js'],
    // Files share a single Postgres database and each does db push
    // --force-reset. Running them in parallel would race and wipe
    // each other's fixtures. Force serial execution at the file level.
    fileParallelism: false,
  },
});
