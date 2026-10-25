---
id: LA-PLT-DR33
kind: domain_rule
title: The shell never starts anything on port 5199
parent: LA-PLT-A7
---
Every server the shell starts MUST listen on a free local port other than 5199, which is the owner's own dev server. The shell MAY connect to 5199, and only when it answers.
