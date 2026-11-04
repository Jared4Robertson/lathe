// Give the sign-in code (LA-PLT-CMD71): the code the browser showed goes to the CLI's sign-in, which asked for it.
// Refused with no sign-in running, or for anything but one line of text.
import type { AgentSignInRepository } from '../repository.ts';

export interface GiveSignInCode {
  /** What the page sent, checked here. */
  code: unknown;
}

/** Whether the sign-in took the code. */
export function giveSignInCode(signIns: AgentSignInRepository, input: GiveSignInCode): boolean {
  const login = signIns.load().login;
  return !!login?.running && typeof input.code === 'string' && login.giveCode(input.code);
}
