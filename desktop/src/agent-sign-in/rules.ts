// The Agent sign-in's rule (one-sign-in-at-a-time, LA-PLT-INV46): the agent is signed in or out by one thing at a time,
// so no sign-out runs while a sign-in does.
import { holdTo, type RuleProblem } from '../rules.ts';
import { signingIn, type AgentSignIn } from './model.ts';

export function agentSignInProblems(signIn: AgentSignIn): RuleProblem[] {
  return signingIn(signIn) && signIn.signingOut ? [{ rule: 'one-sign-in-at-a-time', message: 'Claude Code cannot be signed out while it is being signed in.' }] : [];
}

/** Refuses a sign-in that breaks the rule, with its reason. */
export function holdToRules(signIn: AgentSignIn): void {
  holdTo(agentSignInProblems(signIn));
}
