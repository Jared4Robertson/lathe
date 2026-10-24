---
id: TL-LEND-V01
kind: view
title: Catalog
parent: TL-LEND
links:
  uses: [TL-LEND-E03, TL-LEND-E04]
  fulfills: [TL-LEND-UC02-R02, TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03]
---
Design only; no UI is built in the example.

A list of every tool: name, description and a status badge (Available, On loan, Needs repair). Each available tool has a **Borrow** button. After borrowing, the view shows "Due back by <due date>", a date with no time, for example "Due back by Monday 16 March". A refused borrow shows the reason in plain words, for example "You have an overdue loan; please return it first" or "This tool is out for repair".
