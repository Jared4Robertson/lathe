---
id: LA-BRW-C145
kind: component
title: Children lists that tag kinds only when mixed
parent: LA-BRW-LAY08
component_type: react component
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-BRW-UC110-R05, LA-BRW-DR144, LA-BRW-DR160]
  implements: [LA-BRW-V04]
---
The record tree behind every list of children (record page, side bar, Other records): a layer's components as its children, and each row's kind named only when the list holds more than one kind. `listTitle` titles each list, and names each row's nested list, by its one kind ("Domain rules", "UC requirements of DM-SHOP-UC01"), or "Children" or "Members" when it holds several kinds.
