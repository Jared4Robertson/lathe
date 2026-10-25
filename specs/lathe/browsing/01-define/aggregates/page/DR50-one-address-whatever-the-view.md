---
id: LA-BRW-DR50
kind: domain_rule
title: A thing has one address whatever the view
parent: LA-BRW-A1
---
A record MUST have one address, its bare ID (`/<id>`), and a group one address, its place in the graph's tree (`/<domain-id>/<stage>/<folder>`, or `/<parent-id>/<kind>` for a record's kind group), whichever views (Wiki, Graph, Model) show it; a product's and a domain's address is their overview page. The views MUST NOT change the address's path, only its `view` query parameter, and an older graph address (`/graph/<id>`, `/specs/<product>/<domain>/graph`) MUST lead to the same thing in the Graph view.
