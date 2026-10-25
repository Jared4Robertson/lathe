---
id: LA-BRW-F01
kind: flow
title: Trace a requirement to the tests that prove it
parent: LA-BRW
links:
  uses: [LA-BRW-V01, LA-BRW-V02, LA-BRW-V03, LA-BRW-V04, LA-BRW-E01]
  fulfills: [LA-BRW-UC03-R02]
  carries_out: [LA-BRW-UC01, LA-BRW-UC02, LA-BRW-UC03, LA-BRW-UC110, LA-BRW-UC118]
---
1. The reader picks a product in the Specs menu and sees its domain cards.
2. They open a domain, search for a requirement and open it.
3. On the record page they follow an incoming `proves` link to a test, and from the test its `run_by` file and its other `proves` links.
4. Below the body, its Traceability lists what designs, proves and carries it out, with a callout for each gap, linked to the check that reports it.
