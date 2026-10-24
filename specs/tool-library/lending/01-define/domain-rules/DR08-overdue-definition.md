---
id: TL-LEND-DR08
kind: domain_rule
title: A loan is overdue from the day after its due date
parent: TL-LEND-A3
---
A loan is overdue when it has not been returned and today's date, in the library's time zone, is later than its due date. A loan is never overdue during its due date, up to and including 23:59 that day in the library's time zone, even when UTC has already moved to the next day. It becomes overdue at 00:00 on the next day in the library's time zone. A returned loan is never overdue.
