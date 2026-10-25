---
id: LA-CHK-C162
kind: component
title: Component outside layer check
parent: LA-CHK
component_type: sql check
file: lathe/checks/63-component-outside-layer.sql
links:
  satisfies: [LA-CHK-UC22-R03, LA-CHK-DR164, LA-CHK-DR165]
---
Reports each component whose parent is a domain that has at least one layer.
