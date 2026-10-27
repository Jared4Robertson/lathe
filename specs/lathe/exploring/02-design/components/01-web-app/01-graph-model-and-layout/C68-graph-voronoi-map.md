---
id: LA-EXP-C68
kind: component
title: Graph Voronoi map
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/voronoi.ts
links:
  satisfies: [LA-EXP-DR64, LA-EXP-UC03-R17, LA-EXP-DR58]
  depends_on: [LA-EXP-C55, LA-EXP-C64, LA-EXP-C66]
---
The Voronoi map (`LA-EXP-DR64`). `voronoiTree` reads a product's tree and labels from an index, with a key that changes only when they do; `layoutVoronoi` makes the product a hexagon of a fixed area (`PRODUCT_AREA`), and from the root down, a group of siblings at a time, gives them one text scale (`shareLabels`: the largest, at most the smallest sibling's size share, `cellText`, at which every sibling's label is placed, a leaf's at its largest inscribed point and a parent's in a header at its top), then splits each parent's room below its header into equal-area cells for its children with `voronoiCells`, a power diagram from the d3-voronoi-map library, seeded deterministically and laid out in the parent's own frame. Convex-polygon helpers (`inset`, `below`, `chord`, `contains`, `holds`) do the clipping. `voronoiMap` lays a product out in the worker (`LA-EXP-C69`) the first time an index asks and keeps it for that index; `readyVoronoiMap` reads it when it is ready, reuses the map of a spec loaded again with the same tree, and lays out on the spot where there is no worker. Its nodes are the Tree map's (`PlacedMap`) with each cell's outline, label box, header cut and the tree's order added, so the camera, the minimap and the filters read all three maps alike.
