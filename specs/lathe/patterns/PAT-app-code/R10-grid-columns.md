---
id: LA-PAT-APP-CODE-R10
kind: pattern_rule
title: Every grid says its columns
parent: LA-PAT-APP-CODE
group: Markup and style
---
A CSS grid MUST declare `grid-template-columns`, and a single column MUST be `minmax(0, 1fr)`. A grid with no column template sizes its column to its widest content, so a long title or a wide list would widen the column past its panel and be cut off, instead of shrinking, wrapping or truncating. An icon grid that only centers one item (`place-items`) is exempt.
