---
id: TL-LEND-UC01
kind: use_case
title: Register a member
parent: TL-LEND-CAP01
actor: Librarian
record: Member
required_input: The member's name and a valid email address.
result: The new member with their ID, which goes on their card.
links:
  applies: [TL-LEND-DR01]
  follows: [TL-PAT-LIBRARIAN-ACTION]
---
A librarian registers a new member so that the member can borrow tools.

1. The librarian enters the member's name and email.
2. The library checks the email is not already registered and records the member.
3. The library shows the new member's ID, which goes on their card.
