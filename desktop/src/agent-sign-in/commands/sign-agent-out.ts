// Sign the agent out (LA-PLT-CMD73): the CLI signs out (`claude auth logout`), so the Owner can sign in with another
// account. Refused while a sign-in runs (one-sign-in-at-a-time) or another sign-out does.
import type { AgentSignInRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface SignAgentOut {
  /** Signs the CLI out (claudeLogin.ts claudeSignOut); null without a `claude`. */
  signOut: (() => Promise<boolean>) | null;
}

/** Whether the CLI signed out. */
export async function signAgentOut(signIns: AgentSignInRepository, input: SignAgentOut): Promise<boolean> {
  const now = signIns.load();
  if (!input.signOut || now.signingOut) return false;
  const next = { ...now, signingOut: true };
  try {
    holdToRules(next);
  } catch {
    return false;
  }
  signIns.save(next);
  try {
    return await input.signOut();
  } finally {
    signIns.save({ ...signIns.load(), signingOut: false });
  }
}
