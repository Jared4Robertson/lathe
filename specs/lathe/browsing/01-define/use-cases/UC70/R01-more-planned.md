---
id: LA-BRW-UC70-R01
kind: requirement
title: The planned bar shows proof still owed beyond the unproved
parent: LA-BRW-UC70
---
Where the engine reports `planned_any` greater than `planned` for an obligation kind, the planned bar MUST say `N more planned`, N being the difference, with a hover text saying those are already proved but still have a planned test. Where they are equal, or `planned_any` is not reported, nothing more MUST be shown.
