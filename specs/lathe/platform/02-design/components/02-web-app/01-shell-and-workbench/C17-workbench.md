---
id: LA-PLT-C17
kind: component
title: Workbench panels and sizes
parent: LA-PLT-LAY03
component_type: module
file: app/src/App.tsx
links:
  satisfies: [LA-PLT-UC05-R01, LA-PLT-UC05-R02, LA-PLT-UC05-R03, LA-PAT-APP-UX-R02, LA-PAT-APP-CODE-R10]
---
The app shell lays the navigation, a gap and the page out on the shell background, and the focus page lays its panes and the side bar out the same way; each panel is marked `panel` and each gap is a resize handle whose size `usePanelSize` (`app/src/shell/prefs.ts`) keeps, within its limits, in local storage. The stylesheet gives every grid its columns.
