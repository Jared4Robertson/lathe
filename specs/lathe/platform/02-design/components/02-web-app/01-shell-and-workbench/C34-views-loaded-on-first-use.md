---
id: LA-PLT-C34
kind: component
title: Views loaded on first use
parent: LA-PLT-LAY03
component_type: module
file: app/src/App.tsx
links:
  satisfies: [LA-PAT-APP-UX-R11]
---
The shell loads the theme editor (`app/src/theme/AppearancePage.tsx`) with `React.lazy`, as the focus page does the graph and the Model view, so the wiki's first load fetches no React Flow and no ELK: about 160 KB of JavaScript gzipped, down from 660 KB. While a page's code loads, its place shows "Loading…".
