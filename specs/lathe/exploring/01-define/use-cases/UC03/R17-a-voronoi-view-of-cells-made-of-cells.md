---
id: LA-EXP-UC03-R17
kind: requirement
title: The Voronoi view shows each parent as a polygon cell made of its children's cells
parent: LA-EXP-UC03
---
The Voronoi layout MUST draw the focus's product as a hexagon split into polygon cells, one per domain, each domain's cell split into Define and Design, and so on down to the records, every cell as big as the records under it and never too small for its own name (`LA-EXP-DR64`), so the shape of a product can be compared with its Tree and Nested pictures. It MUST share the Nested view's camera, level of detail and keyboard order (`LA-EXP-DR63`), every drawn cell showing its label at its own size inside it (`LA-EXP-DR58`, `LA-PAT-APP-UX-R12`), and it MUST never keep the page waiting while it is laid out: the layout runs off the main thread, and the canvas fills once it is ready.
