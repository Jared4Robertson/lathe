---
id: TL-LEND-C07
kind: component
title: server.ts
parent: TL-LEND-LAY03
component_type: app
file: examples/tool-library/src/server.ts
links:
  depends_on: [TL-LEND-C02, TL-LEND-C06]
---
The entry point: opens the store (`DB`, default in memory) and serves the router on `127.0.0.1` at `PORT` (default 5310), with the library's time zone from `TIME_ZONE` (default `America/New_York`). An unknown time zone stops it at start-up with a message. Stops cleanly on SIGINT or SIGTERM.
