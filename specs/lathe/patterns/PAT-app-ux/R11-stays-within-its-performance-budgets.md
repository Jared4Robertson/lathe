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
- a graph re-center at depth 3 takes under 500 ms of main-thread work, from the click until the glide has ended; at most 3 of its frames take more than 20 ms, and none takes 100 ms or more. A re-center moves only the camera over the one map: the boxes the glide passes over are drawn once as it starts and trimmed when it ends, at most a budget of boxes at a time, so its frames move one viewport transform; the frame of the click, where the page for the new address is drawn, is the longest.

Layout never blocks the main thread: the graph lays out its one map directly, once per index, and draws only what is in view and big enough to see, within a budget of boxes; ELK runs in a web worker (`app/src/elk.ts`) for the Model view. Work a re-center repeats for every frame or every box is done once: a domain's folders and a group's marks are worked out once per index. When the machine is busy (a one-minute load average above 12), the suite measures and prints but judges nothing ("not run: machine busy"); a budget is never loosened to make a busy run pass.
