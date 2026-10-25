---
id: LA-AUT-C65
kind: component
title: Kinds and checks in quick find
parent: LA-AUT-LAY09
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-AUT-UC14-R07]
  depends_on: [LA-EXP-C17, LA-AUT-C63]
---
Quick find's items include each kind as "Kind: <label>" and each check as "Check: <name>" (the reference's checks, fetched once something is typed, and any check a problem names), ranked like every other item.
