---
id: LA-EXP-C27
kind: component
title: Spaces
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/spaces.tsx
links:
  reacts_to: [LA-EXP-EV01]
  satisfies: [LA-EXP-UC07-R02, LA-EXP-UC07-R04, LA-EXP-DR12, LA-EXP-DR13, LA-EXP-DR14, LA-EXP-DR15]
---
`useSpaceState` works out the current space from the page (`productOfPath`) or the one last chosen, and remembers each space's last page in session storage; `spaceOf` gives a product's icon or monogram and color; `SpaceMark` draws it.
