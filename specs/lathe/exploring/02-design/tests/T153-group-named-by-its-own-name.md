---
id: LA-EXP-T153
kind: test
title: A stage or folder group page names the group by its own name, not by a kind
parent: LA-EXP
test_type: component
run_by: app/test/group-names-and-tab-settings.test.tsx
links:
  proves: [LA-EXP-UC04-R03]
---
Opens a domain's Define stage page and expects its intro and the side bar to say "Define", never "Defines".
