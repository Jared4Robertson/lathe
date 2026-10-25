---
id: LA-BRW-C231
kind: component
title: The graph header holds still
parent: LA-BRW-LAY14
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-BRW-UC117-R06, LA-BRW-DR240, LA-BRW-DR241, LA-BRW-DR242]
---
The graph's header is two fixed lines: the trail of records visited is one line whose earlier items shrink with an ellipsis and which scrolls to the center at its end; the toolbar is one line, with the count as one text right after the depth and trace mode and the filters at its end. The graph tells the host what it connects in a layout effect, so the inspector shows it in the same frame.
