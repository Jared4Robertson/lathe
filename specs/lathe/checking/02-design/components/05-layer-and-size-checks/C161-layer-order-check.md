---
id: LA-CHK-C161
kind: component
title: Layer order check
parent: LA-CHK-LAY10
component_type: sql check
file: lathe/checks/62-layer-order.sql
links:
  satisfies: [LA-CHK-UC22-R02, LA-CHK-DR162, LA-CHK-DR163]
---
Reports each layer whose `order` is not a whole number, and each layer whose order, read as a number, another layer of the same domain also has.
