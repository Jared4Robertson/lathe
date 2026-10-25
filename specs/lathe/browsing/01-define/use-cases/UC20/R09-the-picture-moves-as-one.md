---
id: LA-BRW-UC20-R09
kind: requirement
title: The picture moves as one when the graph re-centers
parent: LA-BRW-UC20
---
When the graph re-centers, the nodes MUST glide to their new places and every line between two nodes that stay MUST move with them, with the same duration and easing, so each end stays on its node box throughout (see LA-BRW-DR147). A line that is new in the picture MUST fade in, and a line that leaves MUST fade out, over the same time; a line's label moves or fades with it. Re-centering MUST move the camera, not the picture: the new picture is anchored on the new focus, so it keeps the place it had and records in both pictures move little (see LA-BRW-DR180), and the view then pans, and zooms when the new picture needs another scale, to frame the new focus, starting with the nodes' move and lasting as long (see LA-BRW-DR181). A record new to the picture MUST fade in at its place, and a record that leaves MUST fade out where it was. The first picture of a page appears at once. When the system asks for reduced motion, nothing MUST animate: nodes and lines jump to the new picture, framed on the focus (see LA-BRW-DR148).
