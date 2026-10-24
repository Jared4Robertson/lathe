---
id: LA-CHK-UC04-R02
kind: requirement
title: Each record's product and domain come from its parents
parent: LA-CHK-UC04
---
The engine MUST compute each record's `product` and `domain` by following `parent`. A parent cycle MUST be reported as an error `parent-cycle`, and the walk MUST stop rather than loop.
