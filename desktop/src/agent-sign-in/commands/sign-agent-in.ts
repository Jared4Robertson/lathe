// Sign the agent in (LA-PLT-CMD70): the CLI's own sign-in starts, with the Owner's subscription or a Console account,
// and opens the browser; the panel follows it. Refused for a way Lathe does not know, while a sign-in or a sign-out
// runs, or when the CLI cannot start.
import { isSignInMethod, type ClaudeLogin } from '../../claudeLogin.ts';
import type { AgentSignInRepository } from '../repository.ts';
import { signingIn } from '../model.ts';

export interface SignAgentIn {
  /** What the page sent, checked here: "claudeai" or "console". */
  method: unknown;
  /** Makes the sign-in, not yet started (main.ts: finds the user's `claude`, and tells every window how it goes); null without one. */
  create: () => ClaudeLogin | null;
}

/** Whether the sign-in started. */
export function signAgentIn(signIns: AgentSignInRepository, input: SignAgentIn): boolean {
  const now = signIns.load();
  if (!isSignInMethod(input.method) || signingIn(now) || now.signingOut) return false;
  const login = input.create();
  if (!login) return false;
  signIns.save({ ...now, login });
  return login.start(input.method);
}
