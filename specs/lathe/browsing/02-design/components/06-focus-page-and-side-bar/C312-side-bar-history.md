---
id: LA-BRW-C312
kind: component
title: The side bar's History
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/SideBarHistory.tsx
links:
  satisfies: [LA-BRW-UC119-R05]
  depends_on: [LA-BRW-C313]
---
The commits of the record's spec file from `GET /api/history` (the client and the diff reader are `app/src/views/history.ts`), the uncommitted change first, twenty at a time with Load more, each row opening its diff inline with added and removed lines in the diff tokens; a calm hint when there is no git. It reloads with the specs.
