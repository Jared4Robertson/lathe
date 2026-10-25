---
id: LA-EXP-T33
kind: test
title: A group's chevron opens it in place and closes it again, open groups are remembered, and clicking the group goes to it
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R01, LA-EXP-UC04-R02]
---
Renders a domain, expects folder-shaped folded groups with counts, clicks one's chevron and expects its members without an address change, walks to a member and back and expects it still open, clicks the chevron again to close it, then clicks the group and expects its address with the group at the center and no chevron.
