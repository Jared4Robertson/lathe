---
id: LA-EXP-DR61
kind: domain_rule
title: "A domain is drawn as a hexagon"
parent: LA-EXP-EN06
---
In the graph every domain node MUST be drawn as a hexagon, with flat top and bottom edges and pointed left and right ends, drawn as a polygon, not a rotated box. The points' chamfer MUST grow with the node's box scale (12 map units at box scale 1), at most a quarter of its width, so a very tall domain still reads as a hexagon and not as a diamond. Its border MUST follow the outline in every state, hovered, focused, keyboard-focused and selected by a tap, by coloring and thickening the outline's own edge, drawn inside the polygon. A parent line into a domain MUST meet the tip of its point, and a parent line out of one MUST start on its slanted side, where the outline is at the child's middle; a line meets every other shape's outline the same way (`LA-EXP-DR65`). The minimap draws boxes.
