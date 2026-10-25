---
id: LA-BRW-DR52
kind: domain_rule
title: A link's views win over the remembered ones
parent: LA-BRW-A1
---
When an address names views (`?view=wiki`, `?view=wiki,graph`, `?view=graph,model`; the old `?view=split` names the wiki and the graph) the page MUST open with those views, and they become the remembered ones; only an address without views MUST fall back to the views last open. A view the page does not offer (Model, away from a domain, aggregate or entity) MUST be dropped from what it shows; when that leaves none, the page MUST show the wiki.
