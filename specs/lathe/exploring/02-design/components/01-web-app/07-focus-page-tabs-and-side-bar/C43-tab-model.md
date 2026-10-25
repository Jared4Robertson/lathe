---
id: LA-EXP-C43
kind: component
title: Tab model
parent: LA-EXP-LAY08
component_type: module
file: app/src/views/tabs.ts
links:
  satisfies: [LA-EXP-DR32, LA-EXP-DR33, LA-EXP-UC10-R01, LA-EXP-UC10-R03]
---
Pure functions over a tab set, generic over each tab's state so anything that holds tabs can own one (a space today, a pane's editor group later): open (activate a page's tab, or open it in the preview tab or as a lasting tab), keep, close (the right neighbor, else the left; the last tab stays as the preview), activate, cycle, update one tab's state, and read a stored set back, dropping anything malformed.
