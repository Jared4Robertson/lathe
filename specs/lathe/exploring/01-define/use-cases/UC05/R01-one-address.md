---
id: LA-EXP-UC05-R01
kind: requirement
title: A record or group has one address, whatever the view
parent: LA-EXP-UC05
group: Addresses
---
A record MUST be shown at its bare ID (`/<id>`), a product and a domain included, and a group of the graph's tree at its place in it: a stage or folder at `/<domain-id>/<stage>/<folder>` (a test-plan group's parts after it, `/<domain-id>/design/test-plan/acceptance/…`), a record's kind group at `/<parent-id>/<kind>`, in every view. Any other address, `/records/…`, `/specs/…` and `/graph/…` included, MUST show that there is no such page, and MUST stay as it was typed.
