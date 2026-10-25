---
id: LA-BRW-UC50-R01
kind: requirement
title: A record or group has one address, whatever the view
parent: LA-BRW-UC50
---
A record MUST be shown at its bare ID (`/<id>`), a product and a domain included, and a group (a parent record and the kind of its children, as in the graph) at `/<parent-id>/<kind>`, with the parts of a group within it after the kind (`/<parent-id>/test/acceptance/…`), in every view. The older addresses MUST redirect, replacing the history entry and keeping the query and hash: `/records/<id>` and `/records/<parent-id>/<kind>…` to the same path without `/records`, `/specs` to the products at `/`, `/specs/<product>` to `/<product>`, `/specs/<product>/<domain>` to `/<domain>`; `/graph/<id>` and `/graph/<parent-id>/<kind>` to that address with the Graph view, `/graph` to the first product in the Graph view, and `/specs/<product>/<domain>/graph` to the domain page in the Graph view.
