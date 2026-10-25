---
id: LA-CHK-UC04-R10
kind: requirement
title: A test that proves and supports nothing is a warning
parent: LA-CHK-UC04
---
A test with no `proves` and no `supports` link to a record that exists MUST be reported as a `test-proves-nothing` warning, whatever its state. Running a flow or covering a component does not count.
