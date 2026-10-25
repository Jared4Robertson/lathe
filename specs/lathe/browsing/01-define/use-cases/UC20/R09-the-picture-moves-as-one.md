---
id: LA-BRW-UC20-R09
kind: requirement
title: The picture moves as one when the graph re-centers
parent: LA-BRW-UC20
---
When the graph re-centers, the nodes MUST glide to their new places and every line between two nodes that stay MUST move with them, with the same duration and easing, so each end stays on its node box throughout (see LA-BRW-DR147). A line that is new in the picture MUST fade in, and a line that leaves MUST fade out, over the same time; a line's label moves or fades with it. When the system asks for reduced motion, nothing MUST animate: nodes and lines jump to the new picture (see LA-BRW-DR148).
