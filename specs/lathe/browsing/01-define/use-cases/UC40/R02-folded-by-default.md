---
id: LA-BRW-UC40-R02
kind: requirement
title: Groups are folded until opened, and open groups are remembered
parent: LA-BRW-UC40
---
A group MUST show its count but not its members, unless the reader has opened it, or the focus is one of its members at depth 2 or 3 (at depth 1 the focus's own folder stays folded, so its siblings do not show). A group MUST end in a chevron, pointing right when folded and down when open. Clicking the chevron, or pressing o on the group, MUST open it (its members appear in the next column) without changing the address, and doing so again MUST close it; keyboard focus MUST stay on the group. Clicking the group itself, or pressing Enter on it, MUST go to its address, as clicking a record does. The groups the reader opened or closed MUST stay that way while they walk the graph.
