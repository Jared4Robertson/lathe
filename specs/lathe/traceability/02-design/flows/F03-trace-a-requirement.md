---
id: LA-TRC-F03
kind: flow
title: Trace a requirement to the tests that prove it
parent: LA-TRC
links:
  uses: [LA-EXP-V01, LA-TRC-V01, LA-EXP-V02, LA-EXP-V03, LA-PLT-E01]
  fulfills: [LA-EXP-UC02-R02]
  carries_out: [LA-TRC-UC09, LA-EXP-UC01, LA-EXP-UC02, LA-EXP-UC09, LA-TRC-UC14]
---
1. The reader picks a product in the Specs menu and sees its domain cards.
2. They open a domain, search for a requirement and open it.
3. On the record page they follow an incoming `proves` link to a test, and from the test its `run_by` file and its other `proves` links.
4. Below the body, its Traceability lists what designs, proves and carries it out, with a callout for each gap, linked to the check that reports it.
