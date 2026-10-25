---
id: LA-BRW-C202
kind: component
title: Kinds and checks in quick find
parent: LA-BRW-LAY03
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-BRW-UC115-R07]
  depends_on: [LA-BRW-C54, LA-BRW-C200]
---
Quick find's items include each kind as "Kind: <label>" and each check as "Check: <name>" (the reference's checks, fetched once something is typed, and any check a problem names), ranked like every other item.
