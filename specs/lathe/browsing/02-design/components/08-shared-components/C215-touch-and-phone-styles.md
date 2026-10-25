---
id: LA-BRW-C215
kind: component
title: Touch and phone styles
parent: LA-BRW-LAY08
component_type: module
file: app/src/styles.css
links:
  satisfies: [LA-PAT-APP-UX-R07, LA-BRW-UC116-R01, LA-BRW-UC116-R03, LA-BRW-UC116-R08, LA-BRW-UC116-R09, LA-BRW-UC116-R10, LA-BRW-DR220]
---
The stylesheet's phone and touch rules: the top bar, the compact page bar, the sheets and their motion, the quick find sheet, the full-screen palette, the tap card, 16 px text boxes, the safe areas and `100dvh`; under `(pointer: coarse)` the 44 px targets (`--touch-target`), as the controls themselves or as a `::before` stretched around a small one, the nav rows at 44 px, and the tab close buttons always shown; and the nav rows as in VS Code's explorer.
