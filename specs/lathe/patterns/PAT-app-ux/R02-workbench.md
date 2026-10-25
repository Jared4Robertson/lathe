---
id: LA-PAT-APP-UX-R02
kind: pattern_rule
title: "The workbench: panels a gap apart, every gap resizes"
parent: LA-PAT-APP-UX
---
On a wide screen the app MUST read as a workbench: each area (the navigation, the page, its panes and the inspector) is a panel marked `panel` in the markup, a rounded box on the shell background, and panels sit a gap (`--panel-gap`) apart. Every gap between two panels MUST be a `ResizeHandle` from `app/src/components/ResizeHandle.tsx`, the one component that draws a splitter, and every panel size MUST go through `usePanelSize` (a pane's weight, which belongs to its tab, through the tab's state with the same limits, the last one set remembered as `usePanelSize` would), so each handle drags, steps with the arrow keys (Shift for bigger steps), jumps with Home and End, resets on double-click and is remembered alike. On a narrow screen panels are sheets and nothing is resizable.
