---
id: LA-AUT-C64
kind: component
title: Format reference pages
parent: LA-AUT-LAY09
component_type: react component
file: app/src/format/FormatPages.tsx
links:
  implements: [LA-AUT-V01, LA-AUT-V02, LA-AUT-V03]
  satisfies: [LA-TRC-UC09-R04, LA-AUT-UC15-R01, LA-AUT-UC15-R02, LA-AUT-UC15-R03, LA-AUT-UC15-R04, LA-AUT-DR74]
  depends_on: [LA-EXP-C02, LA-AUT-C65]
---
The format page, a kind's page and a check's page, each in the workbench: one pane with the title in it, and the side bar with the facts beside it (a bottom sheet on a phone). The format page renders `lathe/FORMAT.md` with an anchor on each section, such as `/format#7-fitness`, then the index of kinds by stage and folder, the relations and the checks by severity. Kinds and checks are clickable rows.
