---
id: LA-AUT-C08
kind: component
title: Capability order check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/28-capability-order.sql
links:
  satisfies: [LA-AUT-UC05-R03, LA-AUT-DR15]
---
The `capability-order` check: a capability whose `order` is not a whole number, and each capability whose order equals another's in the same domain, compared as numbers.
