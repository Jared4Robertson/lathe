---
id: LA-EXP-DR59
kind: domain_rule
title: "Focusing moves the camera, never the map"
parent: LA-EXP-A4
---
Focusing a node, by a click, the address, Back and Forward, the step keys or the trail, MUST move the camera only: it MUST frame the focus and the levels the depth shows below it to fill the pane, never zoomed in past a leaf's own size, with the parent's level kept in view in a strip at the left edge. It MUST never zoom out so far that the focus's own title is under 7 pixels on screen (`LA-EXP-DR60`): when the framed levels, widened by their labels (`LA-EXP-DR58`), are too wide for that, the frame starts at the strip and they run past the pane's right edge, reached by panning. The camera MUST move there from the view as it is, including one the person zoomed or panned, in one smooth zoom and pan (zooming out only as far as the pan needs) on the shared motion (`--motion-speed`, `--motion-ease`, at most twice the speed for a long path); on a page's first picture, on a resize and under reduced motion it MUST go there at once. Free zoom and pan (wheel, pinch, drag, the zoom buttons) move the same camera, a gesture during a glide takes over from it, and the frame button and the `.` command frame the focus again.
