// What an aggregate's rules in the shell report, and how a command refuses what breaks them.

/** One way an instance breaks its aggregate's rule: the rule's name, which its record is matched by, and what is wrong. */
export interface RuleProblem { rule: string; message: string }

/** Refuses an instance with every problem its rules find. */
export function holdTo(problems: readonly RuleProblem[]): void {
  if (problems.length) throw new Error(problems.map((p) => p.message).join(' '));
}
