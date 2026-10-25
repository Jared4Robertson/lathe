---
id: LA-BRW-UC50-R01
kind: requirement
title: A record or group has one address, whatever the view
parent: LA-BRW-UC50
---
A record MUST be shown at its bare ID (`/<id>`), a product and a domain included, and a group (a parent record and the kind of its children, as in the graph) at `/<parent-id>/<kind>`, with the parts of a group within it after the kind (`/<parent-id>/test/acceptance/…`), in every view. Any other address, `/records/…`, `/specs/…` and `/graph/…` included, MUST show that there is no such page, and MUST stay as it was typed.
