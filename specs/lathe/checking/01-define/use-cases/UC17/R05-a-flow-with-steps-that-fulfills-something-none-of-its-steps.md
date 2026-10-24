---
id: LA-CHK-UC17-R05
kind: requirement
title: A flow with steps that fulfills something none of its steps does is a warning
parent: LA-CHK-UC17
---
A flow that has steps and `fulfills` a record that none of its steps fulfills MUST be reported as a `flow-fulfills-differs-from-steps` warning naming that record.
