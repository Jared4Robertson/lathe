---
id: TL-LEND-E04
kind: endpoint
title: Borrow a tool
parent: TL-LEND-API03
method: POST
route: /loans
links:
  fulfills: [TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC03-R04]
---
Request: `{ "memberId": number, "toolId": number }`. Responds 201 with the loan, or 400 / 404 / 409 with an error. The checks run in one transaction.

Each rule for its body and responses is one of its interaction requirements.
