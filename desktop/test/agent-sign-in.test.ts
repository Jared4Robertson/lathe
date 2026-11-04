// The Agent sign-in aggregate (LA-PLT-A17): one for the shell, kept in memory; its commands go through its repository,
// and its rule lets one thing sign the agent in or out at a time.
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeLogin } from '../src/claudeLogin.ts';
import { cancelSignIn } from '../src/agent-sign-in/commands/cancel-sign-in.ts';
import { giveSignInCode } from '../src/agent-sign-in/commands/give-sign-in-code.ts';
import { signAgentIn } from '../src/agent-sign-in/commands/sign-agent-in.ts';
import { signAgentOut } from '../src/agent-sign-in/commands/sign-agent-out.ts';
import { AgentSignInRepository } from '../src/agent-sign-in/repository.ts';
import { agentSignInProblems } from '../src/agent-sign-in/rules.ts';

/** A sign-in that records what it is asked; it runs from start until canceled. */
function fakeLogin() {
  const calls: string[] = [];
  const login = {
    running: false,
    start: vi.fn((method: string) => { calls.push(`start ${method}`); login.running = true; return true; }),
    giveCode: vi.fn((code: string) => { calls.push(`code ${code}`); return true; }),
    cancel: vi.fn(async () => { calls.push('cancel'); login.running = false; return true; }),
  };
  return { login, asLogin: login as unknown as ClaudeLogin, calls };
}

describe('LA-PLT-INV46-T One sign-in at a time: no second sign-in, and no sign-out, while one runs', () => {
  it('starts one sign-in, refuses a second and a way it does not know, and refuses signing out while it runs', async () => {
    const signIns = new AgentSignInRepository();
    const first = fakeLogin();
    expect(signAgentIn(signIns, { method: 'password', create: () => first.asLogin })).toBe(false);
    expect(signAgentIn(signIns, { method: 'claudeai', create: () => first.asLogin })).toBe(true);
    const second = fakeLogin();
    expect(signAgentIn(signIns, { method: 'console', create: () => second.asLogin })).toBe(false);
    expect(second.calls).toEqual([]);
    const signOut = vi.fn(async () => true);
    expect(await signAgentOut(signIns, { signOut })).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(agentSignInProblems({ login: first.asLogin, signingOut: true })).toEqual([{ rule: 'one-sign-in-at-a-time', message: 'Claude Code cannot be signed out while it is being signed in.' }]);
    expect(agentSignInProblems({ login: first.asLogin, signingOut: false })).toEqual([]);
  });

  it('refuses a sign-in while the agent is being signed out', async () => {
    const signIns = new AgentSignInRepository();
    let finish: (ok: boolean) => void = () => {};
    const out = signAgentOut(signIns, { signOut: () => new Promise((resolve) => { finish = resolve; }) });
    expect(signIns.load().signingOut).toBe(true);
    expect(signAgentIn(signIns, { method: 'claudeai', create: () => fakeLogin().asLogin })).toBe(false);
    finish(true);
    expect(await out).toBe(true);
    expect(signIns.load().signingOut).toBe(false);
  });
});

describe('LA-PLT-UC30-R01-T02 The sign-in commands reach the sign-in under way through the repository', () => {
  it('gives the code to the sign-in running, and cancels it; with none running, both are refused', async () => {
    const signIns = new AgentSignInRepository();
    expect(giveSignInCode(signIns, { code: 'abc' })).toBe(false);
    expect(await cancelSignIn(signIns)).toBe(false);
    expect(signAgentIn(signIns, { method: 'claudeai', create: () => null })).toBe(false);
    const { asLogin, calls } = fakeLogin();
    signAgentIn(signIns, { method: 'console', create: () => asLogin });
    expect(giveSignInCode(signIns, { code: 42 })).toBe(false);
    expect(giveSignInCode(signIns, { code: 'abc' })).toBe(true);
    expect(await cancelSignIn(signIns)).toBe(true);
    expect(calls).toEqual(['start console', 'code abc', 'cancel']);
    expect(await signAgentOut(signIns, { signOut: null })).toBe(false);
  });
});

describe('LA-PLT-A17-SR01-T01 The sign-in is kept in memory only, whole, and holds no credential', () => {
  it('gives each load a copy of what was saved, and keeps only the sign-in and whether a sign-out runs', () => {
    const signIns = new AgentSignInRepository();
    expect(signIns.load()).toEqual({ login: null, signingOut: false });
    const { asLogin } = fakeLogin();
    signIns.save({ login: asLogin, signingOut: true });
    const loaded = signIns.load();
    expect(loaded).toEqual({ login: asLogin, signingOut: true });
    loaded.signingOut = false;
    expect(signIns.load().signingOut).toBe(true);
    expect(Object.keys(new AgentSignInRepository().load()).sort()).toEqual(['login', 'signingOut']);
  });
});
