---
id: LA-BRW-C150
kind: component
title: Tab model
parent: LA-BRW-LAY06
component_type: module
file: app/src/views/tabs.ts
links:
  satisfies: [LA-BRW-DR150, LA-BRW-DR151, LA-BRW-UC112-R01, LA-BRW-UC112-R03]
---
Pure functions over a tab set, generic over each tab's state so anything that holds tabs can own one (a space today, a pane's editor group later): open (activate a page's tab, or open it in the preview tab or as a lasting tab), keep, close (the right neighbor, else the left; the last tab stays as the preview), activate, cycle, update one tab's state, and read a stored set back, dropping anything malformed.
