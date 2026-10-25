---
id: LA-BRW-T597
kind: test
title: History lists the file's commits, the uncommitted change first, shows a diff inline and loads more
parent: LA-BRW
test_type: acceptance
run_by: app/test/side-bar.test.tsx
links:
  proves: [LA-BRW-UC119-R05]
---
With the history API answered in the test, expects "Not committed" first and then twenty commits with date, author and short hash; the uncommitted diff inline with its removed, added and header lines marked; one diff open at a time; Load more adding the rest; and the calm message when the folder is not a git repository.
