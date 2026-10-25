---
id: LA-EXP-UC09-R02
kind: requirement
title: Test plan groups tests by family and by what they prove
parent: LA-EXP-UC09
---
A domain's Test plan MUST place each test in one group, by its family first: Acceptance tests (it sits under a capability or proves a UC requirement), grouped by capability in order with use cases outside any capability last, then by the first use case it proves in ID order, a capability's test proving no UC requirement sitting in the capability itself; Domain rule tests; Pattern tests, grouped by pattern; Interaction tests; UI tests (`test_type` `ui`, or proving an interaction requirement at a view); Design checks (`test_type` `design`, or only `supports` links); Engineering checks (everything else). The groups MUST be computed from the tests' parents, types and links, not stored, and an empty group MUST NOT be shown.
