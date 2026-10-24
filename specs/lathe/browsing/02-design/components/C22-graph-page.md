---
id: LA-BRW-C22
kind: component
title: Graph page
parent: LA-BRW
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  implements: [LA-BRW-V20]
  satisfies: [LA-BRW-UC20-R02, LA-BRW-UC20-R03, LA-BRW-UC20-R04, LA-BRW-UC20-R05, LA-BRW-UC20-R06, LA-BRW-UC20-R08, LA-BRW-UC21-R01, LA-BRW-UC21-R02]
  depends_on: [LA-BRW-C20, LA-BRW-C21, LA-BRW-C23]
---
The graph view drawn with React Flow: record nodes styled by stage with error and gap marks, folder-shaped group nodes that open and close, straight lines styled by relation (a solid parent/child spine, dashed cross-links), a notice when the layout falls back to radial, the toolbar, filters, side panel and legend, and keyboard handling. Nodes slide to their new places when the graph re-centres.
