---
id: LA-CHK-DR100
kind: domain_rule
title: Proof owed by a planned test is never hidden by other proof
parent: LA-CHK-A2
---
An obligation that a planned test is meant to prove MUST count as proof still owed (`planned_any`) even when an automated or manual test already proves it. A planned test MUST NOT count as proof, so `planned_any` is never less than `planned` and never more than the total.
