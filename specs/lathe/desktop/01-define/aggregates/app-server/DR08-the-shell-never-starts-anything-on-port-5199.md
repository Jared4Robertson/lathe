---
id: LA-DSK-DR08
kind: domain_rule
title: The shell never starts anything on port 5199
parent: LA-DSK-A3
---
Every server the shell starts MUST listen on a free local port other than 5199, which is the owner's own dev server. The shell MAY connect to 5199, and only when it answers.
