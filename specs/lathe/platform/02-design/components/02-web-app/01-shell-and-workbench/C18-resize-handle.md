---
id: LA-PLT-C18
kind: component
title: Resize handle
parent: LA-PLT-LAY03
component_type: react component
file: app/src/components/ResizeHandle.tsx
links:
  satisfies: [LA-PLT-UC06-R01, LA-PLT-UC06-R02, LA-PLT-UC06-R03, LA-PAT-APP-UX-R02, LA-PLT-UC09-R05]
---
The one splitter: a focusable vertical separator that turns a pointer position into a value through its host, clamps it, steps it with the arrow keys, Home and End (toward the panel it sizes), resets it on double-click, and reports a drag below a threshold so the host can fold the panel.
