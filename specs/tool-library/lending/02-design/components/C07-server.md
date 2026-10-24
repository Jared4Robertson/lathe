---
id: TL-LEND-C07
kind: component
title: server.ts
parent: TL-LEND
component_type: app
file: examples/tool-library/src/server.ts
links:
  depends_on: [TL-LEND-C02, TL-LEND-C06]
---
The entry point: opens the store (`DB`, default in memory) and serves the router on `127.0.0.1` at `PORT` (default 5310). Stops cleanly on SIGINT or SIGTERM.
