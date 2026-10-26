---
id: LA-AUT-UC17-R02
kind: requirement
title: A technical step has an order, and may name its path, transaction, locks and statements
parent: LA-AUT-UC17
---
The meta-model MUST have a `design_step` kind whose parent is a technical flow and which requires `order`; a step MAY give `path`, `transaction`, `locks` and `statements`, and the workspace MUST keep them as its fields.
