---
id: LA-BRW-DR281
kind: domain_rule
title: Old addresses keep working
parent: LA-BRW-A1
---
An address in an older form (`/records/<id>`, `/records/<parent-id>/<kind>…`, `/specs`, `/specs/<product>`, `/specs/<product>/<domain>`, `/graph/…`) MUST lead to the same thing at today's address, replacing the history entry and keeping the query and hash, so that links, bookmarks and open tabs keep working. Tabs and a space's last page saved under an older address MUST be read in today's form.
