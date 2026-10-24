---
id: TL-LEND-UC04
kind: use_case
title: Return a tool
parent: TL-LEND
actor: Librarian
links:
  applies: [TL-LEND-DR04, TL-LEND-DR08, TL-LEND-DR09, TL-LEND-DR10]
---
A member brings a tool back; the librarian checks it and records the return.

1. The librarian finds the loan and inspects the tool.
2. The librarian records the condition (`good` or `needs_repair`) and, optionally, a note.
3. The library ends the loan. A tool in good condition goes back on the shelf; a tool needing repair is taken out of lending.
