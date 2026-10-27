---
id: LA-EXP-C83
kind: component
title: Graph look
parent: LA-EXP-LAY09
component_type: module
file: app/src/graph/look.ts
links:
  satisfies: [LA-EXP-DR59, LA-PLT-UC07-R02, LA-PLT-UC07-R07]
---
The graph's look as the canvas draws it, read from the stylesheet's tokens as the browser computes them (`readLook`): the paper, ink, stage, spark, warning and error colors, the hover ring, the links' color, the spotlight's dimming, the vignette's width and the shared motion's fade, so the canvas follows the theme in light and dark. `useThemeVersion` changes whenever the theme may have: its stylesheet, its `data-theme` and `data-mode`, the system's light or dark, or reduced motion.
