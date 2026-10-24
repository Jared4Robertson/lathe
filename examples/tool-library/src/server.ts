// Starts the Tool Library API.
// Spec: TL-LEND-C07 (specs/tool-library/lending/02-design/components/C07-server.md)
// Usage: node src/server.ts   (PORT defaults to 5310, DB defaults to an in-memory database)
import { createServer } from 'node:http';
import { createRouter } from './router.ts';
import { Store } from './store.ts';

const port = Number(process.env.PORT ?? 5310);
const store = new Store(process.env.DB ?? ':memory:');
const server = createServer(createRouter(store));

server.listen(port, '127.0.0.1', () => {
  console.log(`Tool Library API on http://127.0.0.1:${port}`);
});

function stop(): void {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
