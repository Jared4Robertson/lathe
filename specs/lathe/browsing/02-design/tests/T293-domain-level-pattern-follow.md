---
id: LA-BRW-T293
kind: test
title: A pattern the domain itself follows is listed, followed by the whole domain, and every rule applies
parent: LA-BRW
test_type: component
run_by: app/test/patterns.test.tsx
links:
  proves: [LA-BRW-UC60-R01]
---
Makes a domain follow a pattern directly, and expects the pattern among the domain's followed patterns with no use cases, a rule with a setting still applying, and its row on the domain page reading "followed by the whole domain".
