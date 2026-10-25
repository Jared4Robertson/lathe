---
id: LA-BRW-C232
kind: component
title: The ERD key and caption hold still
parent: LA-BRW-LAY09
component_type: react component
file: app/src/model/ModelView.tsx
links:
  satisfies: [LA-BRW-UC117-R03, LA-BRW-UC117-R06, LA-BRW-DR240, LA-BRW-DR241, LA-BRW-DR242]
---
The Model view's caption is one line of one text, cut with an ellipsis. Its key has one height for every ERD (`--erd-key-height`), its line ends in up to three rows, so moving between a domain, an aggregate and an entity never resizes the canvas. The canvas is fitted before its first paint, and observes its size once, acting only on a real change.
