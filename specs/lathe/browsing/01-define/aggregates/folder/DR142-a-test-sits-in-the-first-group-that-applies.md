---
id: LA-BRW-DR142
kind: domain_rule
title: A test sits in one group, by its family first
parent: LA-BRW-A3
---
A test MUST sit in exactly one test group, judged by its family first: Acceptance tests when it sits under a capability or proves a UC requirement; UI tests or Design checks when its `test_type` is `ui` or `design`; then Domain rule tests, Pattern tests, UI tests (proving an interaction requirement at a view), Interaction tests, Design checks (its links are all `supports`) and Engineering checks, by the first that applies to what it proves. The groups are shown in the order acceptance, domain rule, pattern, interaction, UI, design, engineering; within a group, tests sit by their capability, then the first use case or pattern they prove, in ID order.
