---
id: LA-BRW-DR331
kind: domain_rule
title: "A level is as wide as its tallest node, and a node's content grows with it"
parent: LA-BRW-A12
---
In the hierarchy, every node in one level (column) MUST have the same width: a leaf's width times the largest scale in that column, a node's scale being its height over a leaf's, capped at four times a leaf's width (760 px) so a parent's text reads at about a leaf's size when a deep picture is framed, while a depth-3 picture stays about as wide as it is tall. A column of leaves keeps a leaf's width. Columns MUST sit one gap apart at their own widths, so the levels still line up.

Everything inside a node MUST stay in proportion to it: its title, kind and ID line, chevron, padding and marks MUST grow by one scale, the smaller of its width over a leaf's and its height over a leaf's, never below 1, so a leaf stays at today's size. A grown node's content MUST be centered in it, horizontally and vertically. The scale MUST come from the layout, once per picture, never from measuring text in the page, and be set on the node as one CSS variable (`--node-scale`) that its text, padding, marks and chevron read. A re-center MUST glide each node's width, height and scale with its place, and the camera MUST frame the picture at its real column widths, within the re-center budget (LA-PAT-APP-UX-R11).
