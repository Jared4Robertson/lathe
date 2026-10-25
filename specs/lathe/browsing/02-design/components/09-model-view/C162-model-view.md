---
id: LA-BRW-C162
kind: component
title: Model view
parent: LA-BRW-LAY09
component_type: react component
file: app/src/model/ModelView.tsx
links:
  satisfies: [LA-BRW-UC113-R01, LA-BRW-UC113-R02, LA-BRW-UC113-R03, LA-BRW-UC113-R04, LA-BRW-UC113-R05, LA-BRW-DR171, LA-BRW-UC113-R06, LA-BRW-UC113-R07, LA-BRW-UC113-R08, LA-BRW-UC113-R09, LA-BRW-DR307]
  implements: [LA-BRW-V21]
  depends_on: [LA-BRW-C160, LA-BRW-C161, LA-BRW-C148, LA-BRW-C292]
---
Draws a page's ERD with React Flow: each box (blue or gray, root mark, fields, highlight), each line with its ends, a click or Enter on a box going to it, the hover ring, the fit moving with the shared motion, and the key under the diagram with 🟦 and ⬜ for the colors and a drawing of each line end. Domain events are spark pills; a "reacts to" line shows its label on hover (on a domain, the event's name, always shown by touch), and the key explains the pill and its lines. Its icon is `app/src/model/ModelIcon.tsx`.
