---
id: LA-BRW-UC110-R02
kind: requirement
title: Test plan groups tests by what they prove
parent: LA-BRW-UC110
---
A domain's Test plan MUST place each test in the first group that applies: Acceptance tests (it proves a use-case requirement), grouped by capability in order with use cases outside any capability last, then by the first use case it proves in ID order; Domain rule tests; Pattern tests, grouped by pattern; Interaction tests; Engineering checks (everything else). The groups MUST be computed from the tests' `proves` links, not stored, and an empty group MUST NOT be shown.
