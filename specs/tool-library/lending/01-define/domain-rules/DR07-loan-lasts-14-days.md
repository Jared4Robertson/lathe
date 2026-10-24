---
id: TL-LEND-DR07
kind: domain_rule
title: A loan is due 14 calendar days after it starts
parent: TL-LEND-A3
---
A loan's due date MUST be the date it starts plus 14 calendar days, both dates taken in the library's time zone. The due date is a date (YYYY-MM-DD), not a time: it is stored and shown that way. The loan is due by the end of that day.

The library's time zone is a setting, an IANA name, defaulting to `America/New_York`. For example, a loan started at 23:30 on 2 March in New York (04:30 on 3 March in UTC) is due on 16 March.
