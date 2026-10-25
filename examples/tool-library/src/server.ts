// Starts the Tool Library API.
// Spec: TL-LEND-C07 (specs/tool-library/lending/02-design/components/03-router-and-server/C07-server.md)
// Usage: node src/server.ts
//   PORT defaults to 5310, DB to an in-memory database, TIME_ZONE to America/New_York.
import { createServer } from 'node:http';
import { DEFAULT_TIME_ZONE, assertTimeZone } from './model.ts';
import { createRouter } from './router.ts';
import { Store } from './store.ts';

const port = Number(process.env.PORT ?? 5310);
const timeZone = process.env.TIME_ZONE || DEFAULT_TIME_ZONE;
try {
  assertTimeZone(timeZone);
} catch {
  console.error(`TIME_ZONE "${timeZone}" is not a known time zone.`);
  process.exit(1);
}
const store = new Store(process.env.DB ?? ':memory:');
const server = createServer(createRouter(store, () => new Date(), { timeZone }));

server.listen(port, '127.0.0.1', () => {
  console.log(`Tool Library API on http://127.0.0.1:${port} (time zone ${timeZone})`);
});

function stop(): void {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
