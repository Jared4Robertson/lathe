---
id: LA-EXP-DR49
kind: domain_rule
title: Links adds the center's own links, one hop
parent: LA-EXP-EN08
---
With the Links switch on, the graph MUST add the records the focused record links to and from, one hop, with the relation filters applied, and the links between them and the focus, drawn as dashed curves in their own color (`--link-edge`) between their boxes. Each linked record is drawn wherever it sits in the map, whatever its size on screen, and keeps its own place there: links never move anything. A linked record off screen MUST be counted by the edge hint on its side (`LA-EXP-UC03-R12`). With it off, the graph MUST draw no cross-links. Trace mode stays for a whole chain.
