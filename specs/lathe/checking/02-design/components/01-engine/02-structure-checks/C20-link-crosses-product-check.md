---
id: LA-CHK-C20
kind: component
title: Link crosses product check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/80-link-crosses-product.sql
links:
  satisfies: [LA-CHK-UC01-R04, LA-AUT-DR75]
---
The `link-crosses-product` check, one error per source, relation and target: a link whose source sits in one product and whose target sits only in another. Records of no product and dangling links are left to the other checks, and prose is never read.
