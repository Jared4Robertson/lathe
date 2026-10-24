---
id: LA-BRW-UC50-R01
kind: requirement
title: A record or group has one address, whatever the view
parent: LA-BRW-UC50
---
A record MUST be shown at `/records/<id>` and a group (a parent record and the kind of its children, as in the graph) at `/records/<parent-id>/<kind>`, in every view. `/graph/<id>` and `/graph/<parent-id>/<kind>` MUST redirect to that address with the Graph view, `/graph` to the first product in the Graph view, and `/specs/<product>/<domain>/graph` to the domain page in the Graph view.
