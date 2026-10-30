#!/usr/bin/env node
// The Lathe command line. It first finds the packages Lathe runs on, so a checkout whose `lathe` was never installed
// fails with one clear message instead of a stack trace. That matters most for git's merge driver: git runs it from
// each worktree's own `lathe`, and a driver that cannot start leaves a data file marked conflicted holding only our
// side, with no conflict markers, which reads as merged when it is not.
const RUNTIME_PACKAGES = ['@duckdb/node-api'];

const missing = RUNTIME_PACKAGES.filter((name) => {
  try {
    import.meta.resolve(name);
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  const file = process.argv[2] === 'merge-data' ? process.argv[6] : undefined;
  console.error(
    [
      `lathe: ${missing.join(', ')} not found: this checkout's lathe is not installed. Run \`npm ci --prefix lathe\`.`,
      ...(file
        ? [
            `${file} was NOT merged: it holds only our side, with no conflict markers. Do not resolve it by hand or by taking a side.`,
            `After installing, run \`git checkout -m ${file}\` to merge it row by row again.`,
          ]
        : []),
    ].join('\n'),
  );
  process.exit(3);
}
await import('../src/cli/main.ts');
