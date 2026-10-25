---
id: LA-CHK-UC23-R05
kind: requirement
title: A flow's steps are counted per path
parent: LA-CHK-UC23
---
`too-many-children` MUST count a flow's steps per path (a step with no path is on the main path), since each path reads as its own list, and its message MUST name the path when it is not main.
