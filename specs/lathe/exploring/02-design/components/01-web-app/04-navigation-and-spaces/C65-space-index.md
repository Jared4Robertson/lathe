---
id: LA-EXP-C65
kind: component
title: Space index
parent: LA-EXP-LAY05
component_type: module
file: app/src/specs/data.ts
links:
  satisfies: [LA-EXP-DR16, LA-EXP-UC07-R09]
  depends_on: [LA-PLT-C09]
---
`spaceIndex` builds, once per load and product, the index a space reads: the product's records and those of no product, the links and mentions among them, their coverage, and its problems with the workspace's. `useSpaceState` hands the current space's index to the nav, quick find, the focus page (wiki, graph, Model view, side bar), the format reference, the Checks page and the desktop Dock badge, so none of them can show another product.
