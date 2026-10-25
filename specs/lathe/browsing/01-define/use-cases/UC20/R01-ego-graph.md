---
id: LA-BRW-UC20-R01
kind: requirement
title: Depth counts levels of the nav's tree, with the next level faded
parent: LA-BRW-UC20
---
The graph view of `/<record-id>` (`?view=graph`, or its graph pane beside others) MUST walk the nav's tree, stages and folders included (see LA-BRW-DR300), and at depth N (1 by default, up to 3) MUST show the record's ancestors up to N levels and its descendants down to N levels, with no siblings and no cross-links (see LA-BRW-DR301): at depth 1 its parent (or folder) and its children (or their folders), its own folder folded until opened. Around that it MUST draw the context ring, the next level out each way, faded and out of focus (see LA-BRW-DR302), unless the person switches it off under Filters. A Links switch beside Depth, off by default, MUST add the record's own links, one hop (see LA-BRW-DR304). `/graph` on its own MUST open the first product.
