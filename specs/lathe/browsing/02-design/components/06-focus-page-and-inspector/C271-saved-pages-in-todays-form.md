---
id: LA-BRW-C271
kind: component
title: Saved tabs and space pages in today's form
parent: LA-BRW-LAY06
component_type: react hook
file: app/src/views/useTabs.ts
links:
  satisfies: [LA-BRW-DR281, LA-BRW-UC112-R06]
  depends_on: [LA-BRW-C50, LA-BRW-C151]
---
When the tab sets are read from session storage, each tab's page goes through `currentAddress`, so a tab saved under `/records/<id>` or `/specs/<product>/<domain>` opens at its bare ID, and is written back that way. The spaces read each space's last page the same way (`app/src/shell/spaces.tsx`).
