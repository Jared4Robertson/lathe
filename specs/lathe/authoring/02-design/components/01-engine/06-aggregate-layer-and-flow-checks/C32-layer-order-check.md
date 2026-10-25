---
id: LA-AUT-C32
kind: component
title: Layer order check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/62-layer-order.sql
links:
  satisfies: [LA-AUT-UC09-R02, LA-AUT-DR42, LA-AUT-DR43]
---
Reports each layer whose `order` is not a whole number, and each layer whose order, read as a number, another layer of the same domain also has.
