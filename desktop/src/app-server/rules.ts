// The App server's rule (LA-PLT-INV06): a server the shell starts never listens on 5199, the owner's dev server's
// port, which the shell only shares.
import { SHARED_PORT } from '../devSource.ts';
import type { AppServers } from './model.ts';

/** The label of the owner's dev server, which the shell shares and never starts. */
export const SHARED_LABEL = 'shared dev server';

export function appServerProblems(servers: AppServers): string[] {
  const problems: string[] = [];
  for (const [folder, { server }] of servers.running) {
    const port = Number(new URL(server.url).port);
    if (server.label !== SHARED_LABEL && port === SHARED_PORT) problems.push(`The server the shell started for ${folder} listens on ${SHARED_PORT}, the owner's dev server's port.`);
  }
  return problems;
}

/** Refuses servers that break a rule, with every reason. */
export function holdToRules(servers: AppServers): void {
  const problems = appServerProblems(servers);
  if (problems.length) throw new Error(problems.join(' '));
}
