---
id: TL-LEND-F03
kind: flow
title: Register a member
parent: TL-LEND-CAP01
links:
  uses: [TL-LEND-E01]
  fulfills: [TL-LEND-UC01-R01, TL-LEND-UC01-R02, TL-LEND-UC01-R03]
  carries_out: [TL-LEND-UC01]
---
How a new member joins the library.

1. A librarian takes the person's name and email and registers them (`POST /members`).
2. If the name is blank, the email is not an email address, or the email is already registered, the request is refused and the librarian is told why.
3. Otherwise the new member is shown with the member ID to write on their card.
