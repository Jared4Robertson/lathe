---
id: LA-EXP-C21
kind: component
title: Mention links in rendered Markdown
parent: LA-EXP-LAY07
component_type: module
file: app/src/specs/Markdown.tsx
links:
  satisfies: [LA-EXP-UC02-R06, LA-EXP-UC02-R07, LA-EXP-V03-R05]
---
After Markdown is rendered and sanitized, walks its text (skipping code, pre and links) and replaces each whole ID token that is a mention with a link carrying the record's title, and each reported unknown ID with a broken-link span. A plain click on a mention moves within the app, through the host's navigation when it has one.
