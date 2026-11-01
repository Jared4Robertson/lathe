// Starts the Tool Library API and the library's daily clock.
// Spec: the entry point TL-LEND-ENTRY01 (examples/tool-library/data/).
// Usage: node src/server.ts
//   PORT defaults to 5310, DB to an in-memory database, TIME_ZONE to America/New_York.
// The clock runs the policy TL-LEND-PO02's event handler at start and once a day. The example has no mail server,
// so each reminder is written to the log.
import { createServer } from 'node:http';
import { Database } from './database.ts';
import { REMINDER_INTERVAL_MS, remindLoansDueTomorrow, type ReminderSender } from './event-handlers.ts';
import { DEFAULT_TIME_ZONE, assertTimeZone } from './model.ts';
import { createRouter, openLibrary } from './router.ts';

const port = Number(process.env.PORT ?? 5310);
const timeZone = process.env.TIME_ZONE || DEFAULT_TIME_ZONE;
try {
  assertTimeZone(timeZone);
} catch {
  console.error(`TIME_ZONE "${timeZone}" is not a known time zone.`);
  process.exit(1);
}
const db = new Database(process.env.DB ?? ':memory:');
const lending = openLibrary(db, () => new Date(), { timeZone });
const server = createServer(createRouter(lending));

const logReminder: ReminderSender = (reminder) => {
  console.log(`Reminder to ${reminder.to}: ${reminder.subject}`);
};
const remind = () => {
  try {
    remindLoansDueTomorrow(lending, logReminder);
  } catch (error) {
    console.error('The daily reminders failed; the clock tries again tomorrow.', error);
  }
};
remind();
const clock = setInterval(remind, REMINDER_INTERVAL_MS);

server.listen(port, '127.0.0.1', () => {
  console.log(`Tool Library API on http://127.0.0.1:${port} (time zone ${timeZone})`);
});

function stop(): void {
  clearInterval(clock);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
