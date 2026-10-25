---
id: LA-EXP-C48
kind: component
title: Model view
parent: LA-EXP-LAY04
component_type: react component
file: app/src/model/ModelView.tsx
links:
  satisfies: [LA-EXP-UC11-R01, LA-EXP-UC11-R02, LA-EXP-UC11-R03, LA-EXP-UC11-R04, LA-EXP-UC11-R05, LA-EXP-DR38, LA-EXP-UC11-R06, LA-EXP-UC11-R07, LA-EXP-UC11-R08, LA-EXP-UC11-R09, LA-EXP-DR52, LA-EXP-DR48]
  implements: [LA-EXP-V05]
  depends_on: [LA-EXP-C46, LA-EXP-C47, LA-EXP-C42, LA-EXP-C57]
---
Draws a page's ERD with React Flow: each box (blue or gray, root mark, fields, highlight), each line with its ends, a click or Enter on a box going to it, the hover ring, the fit moving with the shared motion, and the key under the diagram with 🟦 and ⬜ for the colors and a drawing of each line end. Domain events are spark pills; a "reacts to" line shows its label on hover (on a domain, the event's name, always shown by touch), and the key explains the pill and its lines. Its icon is `app/src/model/ModelIcon.tsx`.
