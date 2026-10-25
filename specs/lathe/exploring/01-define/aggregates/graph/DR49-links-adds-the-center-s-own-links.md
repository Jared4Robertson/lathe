---
id: LA-EXP-DR49
kind: domain_rule
title: Links adds the center's own links, one hop
parent: LA-EXP-EN08
---
With the Links switch on, the graph MUST add the records the focused record links to and from, one hop, with the relation filters applied, in focus, and the links between them and the focus, drawn dashed in their own color (`--link-edge`). Those records MUST NOT bring a context ring of their own. With it off, the graph MUST draw no cross-links. Trace mode stays for a whole chain.
