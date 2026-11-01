// The Lending domain's policies, run by event handlers.
// Spec: the event handlers TL-LEND-PO01-H and PO02-H (examples/tool-library/data/).
import type { Outbox, ToolReturned } from './events.ts';
import type { Loan } from './loan.ts';
import { remindMember, type LoanCommandContext } from './loan-commands.ts';
import { LendingError, addDays, localDate } from './model.ts';
import { reportDamage, type ToolCommandContext } from './tool-commands.ts';

/** The damage note when a tool is returned needing repair with no note. */
export const RETURNED_NEEDING_REPAIR = 'Returned needing repair.';

/**
 * TL-LEND-PO01-H: hears Tool returned, relayed from the outbox, and, when the tool came back needing repair,
 * invokes Report damage through its command handler, in its own transaction, with the return note as the
 * damage note. A tool that already needs repair keeps its first damage report (TL-LEND-INV02): Report damage
 * refuses it, and the handler is done. So an event the relay hands it again after a failure changes nothing.
 * A return recorded as good invokes nothing, so it never clears damage.
 */
export function reportDamageOnReturn(ctx: ToolCommandContext): (event: ToolReturned) => void {
  return (event) => {
    if (event.condition !== 'needs_repair') return;
    try {
      reportDamage(ctx, event.toolId, event.note ?? RETURNED_NEEDING_REPAIR);
    } catch (err) {
      if (err instanceof LendingError && err.code === 'tool_already_damaged') return;
      throw err;
    }
  };
}

/** Subscribes every Lending policy's event handler to the outbox's relay. */
export function subscribePolicies(outbox: Outbox, ctx: ToolCommandContext): void {
  outbox.subscribe('ToolReturned', reportDamageOnReturn(ctx));
}

/** A reminder to send to a member. */
export interface Reminder {
  to: string;
  subject: string;
  text: string;
}

/** Sends a reminder to a member: by mail, or, in the example's server, to the log. Throws when it cannot. */
export type ReminderSender = (reminder: Reminder) => void;

/** How often the library's clock runs TL-LEND-PO02-H. */
export const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * TL-LEND-PO02-H: hears Loan opened through the loan it opened, which keeps its due date, and acts on the day before
 * that date. The library's clock runs it at start and once a day. It finds every active loan due today or tomorrow, in
 * the library's time zone, whose member has not been reminded (so a day the clock missed is made up), invokes Remind a
 * member of a due loan through its command handler, in its own transaction, then sends the reminder. A loan already
 * reminded is refused by the Loan aggregate (TL-LEND-INV08), so each loan's member is reminded at most once: a send that
 * fails is logged and not tried again. Returns the loans reminded.
 */
export function remindLoansDueTomorrow(ctx: LoanCommandContext, send: ReminderSender): Loan[] {
  const today = localDate(ctx.now(), ctx.timeZone);
  const reminded: Loan[] = [];
  for (const due of ctx.loans.notRemindedDueBetween(today, addDays(today, 1))) {
    let loan: Loan;
    try {
      loan = remindMember(ctx, due.id);
    } catch (err) {
      // Returned or reminded since it was read: nothing to send.
      if (err instanceof LendingError && (err.code === 'already_reminded' || err.code === 'already_returned')) continue;
      throw err;
    }
    reminded.push(loan);
    const member = ctx.members.get(loan.memberId);
    const tool = ctx.tools.get(loan.toolId);
    try {
      send({
        to: member.email,
        subject: `${tool.name} is due back on ${loan.dueDate}`,
        text: `Hello ${member.name}, the ${tool.name} you borrowed (loan ${loan.id}) is due back at the library on ${loan.dueDate}.${loan.renewedAt === null ? ' You can renew it once before then.' : ''}`,
      });
    } catch (error) {
      console.error(`The reminder for loan ${loan.id} could not be sent; it is not sent again.`, error);
    }
  }
  return reminded;
}
