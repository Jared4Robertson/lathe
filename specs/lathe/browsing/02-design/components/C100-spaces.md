---
id: LA-BRW-C100
kind: component
title: Spaces
parent: LA-BRW
component_type: react component
file: app/src/shell/spaces.tsx
links:
  satisfies: [LA-BRW-UC90-R02, LA-BRW-UC90-R04, LA-BRW-DR100, LA-BRW-DR101, LA-BRW-DR102, LA-BRW-DR103]
---
`useSpaceState` works out the current space from the page (`productOfPath`) or the one last chosen, and remembers each space's last page in session storage; `spaceOf` gives a product's icon or monogram and colour; `SpaceMark` draws it.
