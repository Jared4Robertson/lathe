---
id: LA-AUT-F02
kind: flow
title: Split a product into domains and check their names
parent: LA-AUT
links:
  fulfills: [LA-AUT-UC02-R01, LA-AUT-UC02-R02, LA-AUT-DR71]
  carries_out: [LA-AUT-UC02]
---
1. An agent, or the owner, reads the record format's section on domains, or follows the modeling skill's first step, and lists the product's business capabilities with the questions it gives.
2. They write one domain record for each capability, and put the technologies each one uses as layers in its Design stage.
3. They run `lathe check`, which warns of any domain whose title or code names a technology, and rename it for its capability.
