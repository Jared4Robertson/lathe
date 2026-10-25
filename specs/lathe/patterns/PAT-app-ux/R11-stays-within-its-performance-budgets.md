---
id: LA-PAT-APP-UX-R11
kind: pattern_rule
title: Lathe stays within its performance budgets
parent: LA-PAT-APP-UX
---
The app MUST stay within its performance budgets, measured on the production build in Chromium on the dev machine by the performance suite (`app/perf`, run by `npm --prefix app run test:perf` after the stability suite for a UI change), whose budgets are in `app/perf/budgets.ts`:

- the JavaScript the wiki's first load fetches is 250 KB or less gzipped: the graph, the Model view, the theme editor, React Flow and ELK load only when first used;
- a record page is interactive within 1.5 s;
- a view switch (opening or closing the Graph or the Model pane) takes under 100 ms of main-thread work;
- a graph re-center at depth 3 takes under 500 ms of main-thread work, from the click until the glide has ended; at most 3 of its frames take more than 20 ms, and none takes 100 ms or more. Under 100 ms of work and 16 ms frames are not met at depth 3: such a re-center adds or removes up to 200 boxes and their edges, the glide redraws every moving box and edge in each of its 20 frames (about 10 ms a frame), so most of the work is the motion itself; and the frame of the click, where the page for the new address is drawn and the hover spotlight marks the boxes, takes 60 to 80 ms (it took 450 to 520 ms before ELK left the main thread and the edges stopped reading the nodes' clock one by one). The glide's other frames stay under 17 ms.

Layout never blocks the main thread: the graph computes its icicle directly, in well under a millisecond, and ELK runs in a web worker (`app/src/elk.ts`) for the Model view. Work a re-center repeats for every frame or every box is done once: the nodes' transition clock is read once a frame for the whole canvas, a box that leaves the picture keeps its element while it fades, and a domain's folders are worked out once per index. When the machine is busy (a one-minute load average above 12), the suite measures and prints but judges nothing ("not run: machine busy"); a budget is never loosened to make a busy run pass.
