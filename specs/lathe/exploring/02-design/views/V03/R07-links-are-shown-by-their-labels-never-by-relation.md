---
id: LA-EXP-V03-R07
kind: interaction_requirement
title: Links are shown by their labels, never by relation codes
parent: LA-EXP-V03
links:
  fulfills: [LA-TRC-UC14-R05]
---
Wherever a page names a link, as a heading, a list title, a field label, an edge label or a tooltip, it MUST use the relation rule's `forward_label` read from the link's source or its `reverse_label` read from its target. A relation code such as `satisfies` or `proves` MUST NOT be shown as a heading or label; it may appear only as code, where a page explains how to write a link.
