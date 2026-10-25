---
id: LA-EXP-C05
kind: component
title: Graph page
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  implements: [LA-EXP-V04]
  satisfies: [LA-EXP-UC03-R02, LA-EXP-UC03-R03, LA-EXP-UC03-R04, LA-EXP-UC03-R05, LA-EXP-UC03-R06, LA-EXP-UC03-R08, LA-TRC-UC10-R01, LA-TRC-UC10-R02, LA-EXP-DR48, LA-EXP-UC03-R10, LA-EXP-UC03-R13, LA-EXP-UC03-R14, LA-EXP-UC03-R15, LA-EXP-UC04-R08, LA-EXP-DR54]
  depends_on: [LA-EXP-C03, LA-EXP-C04, LA-EXP-C06, LA-EXP-C42, LA-EXP-C49]
---
The graph view drawn with React Flow: record nodes styled by stage with error and gap marks, folder-shaped group nodes that open and close, straight lines styled by relation (a solid parent/child spine, dashed cross-links), the toolbar, filters, side bar and legend, and keyboard handling column by column. Each node is drawn at its width and height in the icicle, its content scaled by `--node-scale` and centered (`LA-EXP-DR54`), and parent lines are drawn level (`LA-EXP-DR53`). Nodes slide to their new places and sizes when the graph re-centers, and the lines move with them through the graph motion (`LA-EXP-C42`): each node says where its handles are, so React Flow keeps every line's element across the change instead of dropping it while it re-measures the nodes. Each new layout is anchored on its focus and the viewport glides to frame it, while records entering and leaving fade, through the graph camera (`LA-EXP-C49`).
