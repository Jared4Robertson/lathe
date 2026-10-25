---
id: LA-PLT-C30
kind: component
title: Touch and phone styles
parent: LA-PLT-LAY03
component_type: module
file: app/src/styles.css
links:
  satisfies: [LA-PAT-APP-UX-R07, LA-PLT-UC07-R01, LA-PLT-UC07-R03, LA-PLT-UC07-R08, LA-PLT-UC07-R09, LA-PLT-UC07-R10, LA-EXP-DR41]
---
The stylesheet's phone and touch rules: the top bar, the compact page bar, the sheets and their motion, the quick find sheet, the full-screen palette, the tap card, 16 px text boxes, the safe areas and `100dvh`; under `(pointer: coarse)` the 44 px targets (`--touch-target`), as the controls themselves or as a `::before` stretched around a small one, the nav rows at 44 px, and the tab close buttons always shown; and the nav rows as in VS Code's explorer.
