---
id: LA-AUT-UC10-R01
kind: requirement
title: The meta-model has layers that hold components
parent: LA-AUT-UC10
---
The meta-model MUST have a `layer` kind that sits under a domain in the Technical specification folder and requires an `order`, and MUST let a `component` sit under a domain or a layer, and a `layer` under a layer as its sub-layer. No other kind MAY sit under a layer.
