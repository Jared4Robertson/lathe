---
id: LA-EXP-C52
kind: component
title: The graph header holds still
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-PLT-UC09-R06, LA-PLT-DR18, LA-PLT-DR19, LA-EXP-DR43]
---
The graph's header is two fixed lines: the trail of records visited is one line whose earlier items shrink with an ellipsis and which scrolls to the center at its end; the toolbar is one line, with the count as one text right after the depth and trace mode and the filters at its end. The graph tells the host what it connects in a layout effect, so the side bar shows it in the same frame.
