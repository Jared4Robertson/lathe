// Agent sign-in (LA-PLT-A17): the chat's agent, the Owner's own Claude Code, signed in or out from inside the app,
// one for the whole shell, as the CLI keeps one sign-in for every folder: the last sign-in started (claudeLogin.ts runs
// it), and whether a sign-out is under way. Lathe keeps no credential; the CLI keeps them, and says whether it is signed in.
import type { ClaudeLogin } from '../claudeLogin.ts';

export interface AgentSignIn {
  /** The last sign-in started, running or ended, for its state; none before the first. */
  login: ClaudeLogin | null;
  /** Whether the CLI is being signed out now. */
  signingOut: boolean;
}

export const NO_AGENT_SIGN_IN: AgentSignIn = { login: null, signingOut: false };

/** Whether a sign-in runs now. */
export const signingIn = (signIn: AgentSignIn) => !!signIn.login?.running;
