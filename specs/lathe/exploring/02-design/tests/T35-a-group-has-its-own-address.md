---
id: LA-EXP-T35
kind: test
title: A group has its own address with its parent left and its members right, and Back works
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R03]
---
Follows the domain panel's link to a group, expects the group's address, panel, columns and trail (the domain as "Domain (P-D)", the group as "Use cases" with its parent in the tooltip), follows a member and goes Back to the group; then expects a message for a group that does not exist.
