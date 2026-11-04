// Cancel the sign-in (LA-PLT-CMD72): the CLI's sign-in under way stops, and nothing changes. Refused with none running.
import type { AgentSignInRepository } from '../repository.ts';

/** Whether a sign-in was canceled; resolves once its CLI has ended. */
export function cancelSignIn(signIns: AgentSignInRepository): Promise<boolean> {
  const login = signIns.load().login;
  return login?.running ? login.cancel() : Promise.resolve(false);
}
