---
id: LA-EXP-C53
kind: component
title: The ERD key and caption hold still
parent: LA-EXP-LAY04
component_type: react component
file: app/src/model/ModelView.tsx
links:
  satisfies: [LA-PLT-UC09-R03, LA-PLT-UC09-R06, LA-PLT-DR18, LA-PLT-DR19, LA-EXP-DR43]
---
The Model view's caption is one line of one text, cut with an ellipsis. Its key has one height for every ERD (`--erd-key-height`), its line ends in up to three rows, so moving between a domain, an aggregate and an entity never resizes the canvas. The canvas is fitted before its first paint, and observes its size once, acting only on a real change.
