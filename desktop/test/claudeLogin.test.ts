// Signing the chat's Claude Code in from the app (LA-PLT-UC30) with a stand-in CLI (fixtures/fake-claude-login.mjs):
// never a real sign-in.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { ClaudeLogin, claudeSignOut, readSignInOutput, signInArgs, type SignInState } from '../src/claudeLogin.ts';
import { claudeSignedIn } from '../src/claudeSessions.ts';

const fake = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-claude-login.mjs');
const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-claude-login-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const logins: ClaudeLogin[] = [];
afterEach(async () => {
  await Promise.all(logins.splice(0).map((l) => l.cancel()));
});

/** A sign-in of the stand-in CLI in a mode, with every state it went through and the arguments it ran with. */
function login(mode: 'ok' | 'code' | 'fail' | 'wait') {
  const marker = path.join(temp, `signed-in-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, FAKE_LOGIN: mode, FAKE_CLAUDE_SIGNED_IN: marker };
  const states: SignInState[] = [];
  const args: string[][] = [];
  let waiting: { until: (s: SignInState) => boolean; resolve: () => void } | null = null;
  const run = new ClaudeLogin({
    command: fake,
    env,
    signedIn: () => claudeSignedIn(fake, env),
    onChange: (state) => {
      states.push(state);
      if (waiting?.until(state)) waiting.resolve();
    },
    spawn: (command, a, options) => {
      args.push(a);
      return spawn(process.execPath, [command, ...a], { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    },
  });
  logins.push(run);
  const until = (p: (s: SignInState) => boolean) => (p(run.state) ? Promise.resolve() : new Promise<void>((resolve) => { waiting = { until: p, resolve }; }));
  return { run, states, args, marker, env, until };
}

describe('LA-PLT-UC30-R01-T01 LA-PLT-UC57-R01-T01 The sign-in runs Claude Code\'s own login, passes on its link and code, and asks again when it ends', () => {
  it('runs `auth login` with the method\'s flag only, and nothing else on the command line', () => {
    expect(signInArgs('claudeai')).toEqual(['auth', 'login', '--claudeai']);
    expect(signInArgs('console')).toEqual(['auth', 'login', '--console']);
  });

  it('reads the sign-in page\'s link and a request for a code from what the CLI prints, colors and all', () => {
    const read = readSignInOutput('Opening browser…\n\u001b[4mhttps://claude.ai/oauth/authorize?state=x\u001b[24m\nPaste code here if prompted > ');
    expect(read).toEqual({ url: 'https://claude.ai/oauth/authorize?state=x', asksForCode: true, lastLine: 'Paste code here if prompted >' });
    expect(readSignInOutput('Visit http://insecure.example/ to sign in')).toMatchObject({ url: null, asksForCode: false });
  });

  it('waits for the browser with the link, then asks the CLI and says it is signed in', async () => {
    const { run, args, marker, until, states } = login('ok');
    expect(run.start('claudeai')).toBe(true);
    expect(run.start('claudeai')).toBe(false);
    expect(args).toEqual([['auth', 'login', '--claudeai']]);
    await until((s) => s.status === 'signed-in');
    expect(states.map((s) => s.status)).toEqual(expect.arrayContaining(['waiting', 'checking', 'signed-in']));
    expect(states.find((s) => s.url)?.url).toBe('https://claude.ai/oauth/authorize?code=true&client_id=fake&state=claudeai');
    expect(existsSync(marker)).toBe(true);
    expect(run.running).toBe(false);
  });

  it('asks for the code the browser shows, and gives it to the CLI on its input', async () => {
    const { run, until } = login('code');
    run.start('console');
    await until((s) => s.asksForCode);
    expect(run.state).toMatchObject({ status: 'waiting', method: 'console', asksForCode: true });
    expect(run.giveCode('two\nlines')).toBe(false);
    expect(run.giveCode('  good-code ')).toBe(true);
    expect(run.state.asksForCode).toBe(false);
    await until((s) => s.status === 'signed-in');
  });

  it('fails with the CLI\'s own last words, a wrong code too, and can be tried again', async () => {
    const failed = login('fail');
    failed.run.start('claudeai');
    await failed.until((s) => s.status === 'failed');
    expect(failed.run.state).toMatchObject({ status: 'failed', method: 'claudeai', problem: 'Login failed: the sign-in was denied in the browser.' });
    const wrong = login('code');
    wrong.run.start('claudeai');
    await wrong.until((s) => s.asksForCode);
    wrong.run.giveCode('bad-code');
    await wrong.until((s) => s.status === 'failed');
    expect(wrong.run.state.problem).toBe('Login failed: that code is not valid.');
    expect(wrong.run.start('claudeai')).toBe(true);
  });

  it('says it failed when the CLI ends well but still says it is not signed in', async () => {
    const lying = new ClaudeLogin({ command: fake, env: { ...process.env, FAKE_LOGIN: 'ok' }, signedIn: async () => false, onChange: () => {}, spawn: (c, a, o) => spawn(process.execPath, [c, ...a], { ...o, stdio: ['pipe', 'pipe', 'pipe'] }) });
    logins.push(lying);
    lying.start('claudeai');
    await new Promise<void>((resolve) => { const t = setInterval(() => { if (lying.state.status === 'failed') { clearInterval(t); resolve(); } }, 10); });
    expect(lying.state.problem).toBe('Claude Code still says it is not signed in.');
  });
});

describe('LA-PLT-UC58-R01-T01 Cancel stops the sign-in under way, and nothing changes', () => {
  it('stops the CLI, goes back to no sign-in, and keeps the CLI signed out', async () => {
    const { run, until, marker } = login('wait');
    run.start('claudeai');
    await until((s) => !!s.url);
    expect(await run.cancel()).toBe(true);
    expect(run.state.status).toBe('idle');
    expect(run.running).toBe(false);
    expect(existsSync(marker)).toBe(false);
    expect(await run.cancel()).toBe(false);
    expect(run.giveCode('good-code')).toBe(false);
  });
});

describe('LA-PLT-UC59-R01-T01 Signing out runs Claude Code\'s own logout', () => {
  it('signs the CLI out, so its status says it is not signed in', async () => {
    const { marker, env, run, until } = login('ok');
    run.start('claudeai');
    await until((s) => s.status === 'signed-in');
    expect(await claudeSignedIn(fake, env)).toBe(true);
    expect(await claudeSignOut(fake, env)).toBe(true);
    expect(existsSync(marker)).toBe(false);
    expect(await claudeSignedIn(fake, env)).toBe(false);
    expect(await claudeSignOut(path.join(temp, 'no-such-claude'), env)).toBe(false);
  });
});
