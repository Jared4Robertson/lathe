---
id: LA-BRW-C08
kind: component
title: Format reference pages
parent: LA-BRW-LAY04
component_type: react component
file: app/src/format/FormatPages.tsx
links:
  implements: [LA-BRW-V06, LA-BRW-V07, LA-BRW-V08]
  satisfies: [LA-BRW-UC01-R04, LA-BRW-UC115-R01, LA-BRW-UC115-R02, LA-BRW-UC115-R03, LA-BRW-UC115-R04, LA-BRW-DR211]
  depends_on: [LA-BRW-C07, LA-BRW-C200]
---
The format page, a kind's page and a check's page, each in the workbench: one pane with the title in it, and the side bar with the facts beside it (a bottom sheet on a phone). The format page renders `lathe/FORMAT.md` with an anchor on each section, such as `/format#7-fitness`, then the index of kinds by stage and folder, the relations and the checks by severity. Kinds and checks are clickable rows.
