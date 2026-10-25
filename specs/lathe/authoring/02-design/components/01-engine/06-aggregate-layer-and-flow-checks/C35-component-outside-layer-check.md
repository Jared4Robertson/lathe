---
id: LA-AUT-C35
kind: component
title: Component outside layer check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/63-component-outside-layer.sql
links:
  satisfies: [LA-AUT-UC10-R03, LA-AUT-DR44, LA-AUT-DR45]
---
Reports each component whose parent is a domain that has at least one layer.
