---
id: LA-DSK-DR09
kind: domain_rule
title: The 5199 dev server is shared only for the folder it reads
parent: LA-DSK-A3
---
In development a window MUST load `http://localhost:5199` only when it answers `GET /api/format` and names the opened folder as its product folder in `x-lathe-root` (a server without the header is taken to read the repo the shell runs from). Otherwise the window MUST get a dev server of its own.
