---
id: TL-LEND-UC05
kind: use_case
title: Report damage
parent: TL-LEND-CAP02
actor: Librarian
record: Tool
required_input: A note saying what is wrong, when marking the tool as needing repair; nothing more when marking it repaired.
result: The tool's catalog entry with its new condition and status.
links:
  follows: [TL-PAT-LIBRARIAN-ACTION]
  applies: [TL-LEND-DR04, TL-LEND-DR05, TL-LEND-DR11]
---
A librarian takes a tool out of lending when it is found damaged outside a return (for example on the shelf, or reported by a borrower by phone), and puts it back once fixed.

1. The librarian marks the tool as needing repair and notes what is wrong.
2. Later, the librarian marks the tool repaired, and it can be lent again.
