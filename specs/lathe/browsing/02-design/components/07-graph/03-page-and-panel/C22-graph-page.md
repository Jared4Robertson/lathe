---
id: LA-BRW-C22
kind: component
title: Graph page
parent: LA-BRW-LAY14
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  implements: [LA-BRW-V20]
  satisfies: [LA-BRW-UC20-R02, LA-BRW-UC20-R03, LA-BRW-UC20-R04, LA-BRW-UC20-R05, LA-BRW-UC20-R06, LA-BRW-UC20-R08, LA-BRW-UC21-R01, LA-BRW-UC21-R02, LA-BRW-DR303, LA-BRW-UC20-R10, LA-BRW-UC20-R13, LA-BRW-UC20-R14, LA-BRW-UC20-R15, LA-BRW-UC40-R08, LA-BRW-DR331]
  depends_on: [LA-BRW-C20, LA-BRW-C21, LA-BRW-C23, LA-BRW-C148, LA-BRW-C170]
---
The graph view drawn with React Flow: record nodes styled by stage with error and gap marks, folder-shaped group nodes that open and close, straight lines styled by relation (a solid parent/child spine, dashed cross-links), the toolbar, filters, side bar and legend, and keyboard handling column by column. Each node is drawn at its width and height in the icicle, its content scaled by `--node-scale` and centered (`LA-BRW-DR331`), and parent lines are drawn level (`LA-BRW-DR330`). Nodes slide to their new places and sizes when the graph re-centers, and the lines move with them through the graph motion (`LA-BRW-C148`): each node says where its handles are, so React Flow keeps every line's element across the change instead of dropping it while it re-measures the nodes. Each new layout is anchored on its focus and the viewport glides to frame it, while records entering and leaving fade, through the graph camera (`LA-BRW-C170`).
