---
id: LA-BRW-C73
kind: component
title: Mention links in rendered Markdown
parent: LA-BRW
component_type: module
file: app/src/specs/Markdown.tsx
links:
  satisfies: [LA-BRW-UC60-R06, LA-BRW-UC60-R07, LA-BRW-DR73]
---
After Markdown is rendered and sanitised, walks its text (skipping code, pre and links) and replaces each whole ID token that is a mention with a link carrying the record's title, and each reported unknown ID with a broken-link span. A plain click on a mention moves within the app, through the host's navigation when it has one.
