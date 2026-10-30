// The App server's rule (server-not-on-5199, LA-PLT-INV06): a server the shell starts never listens on 5199, the
// owner's dev server's port, which the shell only shares.
import { SHARED_PORT } from '../devSource.ts';
import { holdTo, type RuleProblem } from '../rules.ts';
import type { AppServers } from './model.ts';

/** The label of the owner's dev server, which the shell shares and never starts. */
export const SHARED_LABEL = 'shared dev server';

export function appServerProblems(servers: AppServers): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const [folder, { server }] of servers.running) {
    const port = Number(new URL(server.url).port);
    if (server.label !== SHARED_LABEL && port === SHARED_PORT) problems.push({ rule: 'server-not-on-5199', message: `The server the shell started for ${folder} listens on ${SHARED_PORT}, the owner's dev server's port.` });
  }
  return problems;
}

/** Refuses servers that break a rule, with every reason. */
export function holdToRules(servers: AppServers): void {
  holdTo(appServerProblems(servers));
}
