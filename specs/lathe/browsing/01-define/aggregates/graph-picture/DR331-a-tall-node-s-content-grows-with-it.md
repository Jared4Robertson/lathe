---
id: LA-BRW-DR331
kind: domain_rule
title: "A tall node's content grows with it, as far as the column allows"
parent: LA-BRW-A12
---
Everything inside a graph node MUST stay in proportion to its height: a tall parent's title, kind and ID line, chevron, padding and marks MUST grow by one scale, its height over a leaf's, but only as far as its content still fits the column's one width (the title in at most two lines, its longest word on one, and the kind-and-ID line on one line or, in a node tall enough for the extra line, broken in two between the kind and the ID). A leaf's scale is 1, and no node's is below 1. The content MUST be centered vertically in the node. The scale MUST be worked out once per picture from the node's height and text, never by measuring text in the page, and set on the node as one CSS variable (`--node-scale`) that its text, padding, marks and chevron read, so a re-center glides it with the node's height and stays within the re-center budget (LA-PAT-APP-UX-R11).
