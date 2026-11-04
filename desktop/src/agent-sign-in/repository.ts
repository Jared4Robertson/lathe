// The Agent sign-in's repository (LA-PLT-REPO27): the sign-in in memory while the shell runs, as the CLI keeps the
// credentials and says itself whether it is signed in. Each load gives a copy, and each save replaces it.
import { NO_AGENT_SIGN_IN, type AgentSignIn } from './model.ts';

export class AgentSignInRepository {
  private kept: AgentSignIn = NO_AGENT_SIGN_IN;

  load(): AgentSignIn {
    return { ...this.kept };
  }

  save(signIn: AgentSignIn): void {
    this.kept = { ...signIn };
  }
}
