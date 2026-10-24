---
id: LA-MOD-C05
kind: component
title: Diagram layout
parent: LA-MOD
component_type: module
file: app/src/layout.ts
links:
  satisfies: [LA-MOD-UC02-R04]
---
Turns a diagram into an ELK graph (contexts contain aggregates and events; aggregates contain their parts), runs the layered layout, and returns React Flow nodes and edges, marking open or ambiguous links as uncertain.
