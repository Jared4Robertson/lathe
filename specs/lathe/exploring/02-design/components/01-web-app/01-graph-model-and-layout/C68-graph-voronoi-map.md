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
The Voronoi map (`LA-EXP-DR64`). `voronoiTree` reads a product's tree and labels from an index, with a key that changes only when they do; `layoutVoronoi` counts the leaf records under each node, gives every level one text scale (`levelTextScale`: 1 at the deepest level, 1.5 times the level below's each level up), and from the leaves up the area each cell's name needs at that scale (its label box over `LABEL_FILL`, a parent's with its children's needs). It makes the product a hexagon of the larger of its records' area and its need, and from the root down places each cell's label at its level's scale (`placeLabel`: a leaf's at its largest inscribed point, a parent's in a header at its top) and splits the room below the header among its children with `voronoiCells`, each weighted by the larger of its records and its need, a power diagram from the d3-voronoi-map library, seeded deterministically and laid out in the parent's own frame, its weights rounded by `quantize`. A cell whose label does not fit has its need grown and the map is laid out again, a bounded number of passes, reusing every parent's cells whose outline and weights are unchanged. Convex-polygon helpers (`inset`, `below`, `chord`, `contains`, `holds`) do the clipping. `voronoiMap` lays a product out in the worker (`LA-EXP-C69`) the first time an index asks and keeps it for that index; `readyVoronoiMap` reads it when it is ready, reuses the map of a spec loaded again with the same tree, and lays out on the spot where there is no worker. Its nodes are the Tree map's (`PlacedMap`) with each cell's outline, label box, header cut and the tree's order added, so the camera, the minimap and the filters read all three maps alike.
