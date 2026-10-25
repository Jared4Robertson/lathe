---
id: LA-EXP-C41
kind: component
title: Children lists that tag kinds only when mixed
parent: LA-EXP-LAY07
component_type: react component
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-EXP-UC09-R05, LA-EXP-DR27, LA-EXP-DR36]
  implements: [LA-EXP-V03]
---
The record tree behind every list of children (record page, side bar, Other records): a layer's components as its children, and each row's kind named only when the list holds more than one kind. `listTitle` titles each list, and names each row's nested list, by its one kind ("Domain rules", "UC requirements of DM-SHOP-UC01"), or "Children" or "Members" when it holds several kinds.
