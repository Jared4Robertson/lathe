---
id: LA-BRW-C76
kind: component
title: The nav without a Graph item
parent: LA-BRW-LAY03
component_type: react component
file: app/src/shell/Nav.tsx
links:
  satisfies: [LA-BRW-UC20-R07, LA-BRW-DR74]
  depends_on: [LA-BRW-C53]
---
The side navigation and its rail list no Graph item; the graph is reached from each page's view toggle, Ctrl+2 and the command palette, and `/graph` addresses still redirect to a page's Graph view.
