---
id: LA-TRC-UC08-R01
kind: requirement
title: Each proved obligation a planned test still owes is named
parent: LA-TRC-UC08
---
For each obligation that is proved and that a planned test is also meant to prove, the check MUST report a `proof-still-owed` warning naming the obligation and the planned test, such as `Requirement TL-LEND-UC01-R01 is proved, but planned test TL-LEND-T30 still owes a proof of it`. A pattern rule MUST be reported for each domain that owes it, naming that domain. An obligation not yet proved MUST NOT get this warning.
