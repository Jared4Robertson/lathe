---
id: LA-BRW-T57
kind: test
title: Clicking a node re-centres the graph and changes the address, and Back walks back
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC20-R01, LA-BRW-UC20-R02]
---
Renders the graph page in jsdom, clicks a neighbour and expects the address, side panel and trail to change; then goes back and expects the first record again. Also expects `/graph` to open the first product.
