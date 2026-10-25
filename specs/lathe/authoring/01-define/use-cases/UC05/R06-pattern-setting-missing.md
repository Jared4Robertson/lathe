---
id: LA-AUT-UC05-R06
kind: requirement
title: A use case that does not give one of its pattern's settings is an error
parent: LA-AUT-UC05
---
For each pattern a use case follows and each valid setting name it lists, the use case MUST have a header field of exactly that name with a non-empty value; otherwise the engine MUST report a `pattern-setting-missing` error. A value starting `Not applicable:`, in any letter case, MUST count as given only when a reason follows it.
