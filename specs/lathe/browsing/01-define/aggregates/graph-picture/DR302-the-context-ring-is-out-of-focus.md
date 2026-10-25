---
id: LA-BRW-DR302
kind: domain_rule
title: "The context ring is the next level out, and out of focus"
parent: LA-BRW-A12
---
At every depth the graph MUST also draw the tree's next level out each way, hierarchy only: the ancestor one level past the depth, and the children of the descendants at the last level. These context nodes MUST be faded (`--context-opacity`) and slightly smaller (`--context-scale`), with their marks and edges faded too and quiet labels (their kind and a short title, the ID and full title in a tooltip on hover, readable while hovered), MUST be left out of the keyboard order and the accessible list (`aria-hidden`), and MUST NOT be counted in the summary or listed in the inspector, which say how many more are faded. A click on one still re-centers on it. The ring is computed once, the same for the same input.
