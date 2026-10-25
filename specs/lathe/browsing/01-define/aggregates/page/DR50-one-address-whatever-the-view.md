---
id: LA-BRW-DR50
kind: domain_rule
title: A thing has one address whatever the view
parent: LA-BRW-A1
---
A record MUST have one address, `/records/<id>`, and a group one address, `/records/<parent-id>/<kind>`, whichever views (Wiki, Graph, Model) show it; a product and a domain keep their overview pages under `/specs`. The views MUST NOT change the address's path, only its `view` query parameter, and an older address (`/graph/<id>`, `/specs/<product>/<domain>/graph`) MUST lead to the same thing in the Graph view.
