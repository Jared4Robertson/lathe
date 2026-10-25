---
id: LA-BRW-UC20-R01
kind: requirement
title: The graph shows a record's parent and children, and its neighbors at depth 2 or 3
parent: LA-BRW-UC20
---
The graph view of `/records/<record-id>` (`?view=graph`, or the graph pane in Split) MUST, at depth 1 (the default), show only the record, its parent one level up (the folder it sits in, when its parent groups its children) and its children one level down (or their folders), with no other links; its own folder stays folded until opened. At depth 2 and 3 it MUST show the record and every record one or two links away, following outgoing links, incoming links and the parent/child relation, with every link between the records shown. `/graph` on its own MUST open the first product.
