---
id: LA-EXP-DR65
kind: domain_rule
title: Each kind is drawn in a shape of its own
parent: LA-EXP-EN06
---
In the graph every kind MUST have one shape, the same in every view, as a secondary cue after its label, and every shape MUST keep a rectangular footprint so boxes still stack:

| Group | Kind | Shape |
|---|---|---|
| Structure | product | a large rounded box |
| | domain | a hexagon (`LA-EXP-DR61`) |
| | stage and folder groups | a folder with a tab |
| | capability | a slice pointing right |
| Define | aggregate | a double border |
| | entity | a plain box |
| | domain rule, pattern rule | an octagon |
| | domain event | a flag, notched on the right |
| | use case | a stadium |
| | requirement | a page with a folded corner; an interaction requirement too, with a marker |
| | pattern | stacked boxes |
| Design | flow | a chevron bar |
| | flow step, technical step | a chevron |
| | view | a window with a top bar |
| | endpoint | a box with a port notch on its left |
| | API, integration | a plain box with a port mark |
| | layer | a striped box |
| | component | a box with component tabs |
| | test | a shield |
| | technical flow | as a flow, with a gear mark |
| Other | open question | a diamond |
| | standard, standard rule | as a pattern and a pattern rule, with a ruler mark |

A kind a product adds MUST be a plain box. In the Tree view and a trace a box's outline MUST be its kind's shape: a polygon shape drawn with its edge inside the polygon, so its border, hover, focus, keyboard ring and a tap's selection color and thicken the outline itself, and a rounded shape with its border's corners and its rings following them. In the Nested and Voronoi views every box MUST keep its rectangle or cell and show its kind's shape as a small mark before its kind and ID line. A shape's corners and notches MUST grow with its box's scale, at most a share of its side. Its label and problem badge MUST stay inside its shape's safe area, which the map keeps when it wraps and sizes the label, so no line is clipped or crowded by a notch or a corner. The Model view MUST draw a domain event as the same flag, and every shape and mark MUST be in the graph's key (`LA-PAT-APP-CODE-R21`).
