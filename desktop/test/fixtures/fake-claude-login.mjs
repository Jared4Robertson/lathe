#!/usr/bin/env node
// A stand-in for the `claude` CLI's sign-in, for the sign-in tests and screenshots: never a real sign-in. It answers
// `auth status --json` (signed in when the file FAKE_CLAUDE_SIGNED_IN names exists), `auth logout` (removes that file)
// and `auth login`, which prints what the real one prints to a pipe and then, by FAKE_LOGIN:
//   "ok"     waits a moment, as for the browser, then signs in and exits 0;
//   "code"   asks for the code the browser shows, and signs in only for "good-code";
//   "fail"   says why it failed and exits 1;
//   "wait"   waits for the browser until it is stopped.
// It reads and writes no credential; every other argument exits 2.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const [group, command, ...rest] = process.argv.slice(2);
const marker = process.env.FAKE_CLAUDE_SIGNED_IN ?? '';
const signedIn = () => !!marker && existsSync(marker);
const signIn = () => { if (marker) writeFileSync(marker, 'signed in\n'); };

if (group !== 'auth') process.exit(2);
if (command === 'status' && rest[0] === '--json') {
  process.stdout.write(`${JSON.stringify(signedIn() ? { loggedIn: true, authMethod: 'claude.ai' } : { loggedIn: false, authMethod: 'none' })}\n`);
  process.exit(signedIn() ? 0 : 1);
}
if (command === 'logout' && rest.length === 0) {
  if (marker) rmSync(marker, { force: true });
  process.stdout.write('Successfully logged out from your Anthropic account.\n');
  process.exit(0);
}
if (command !== 'login' || rest.length !== 1 || !['--claudeai', '--console'].includes(rest[0])) process.exit(2);

const mode = process.env.FAKE_LOGIN ?? 'ok';
process.stdout.write('Opening browser to sign in…\n');
process.stdout.write(`If the browser didn't open, visit: \u001b[4mhttps://claude.ai/oauth/authorize?code=true&client_id=fake&state=${rest[0].slice(2)}\u001b[24m\n`);
if (mode === 'ok') {
  setTimeout(() => { signIn(); process.stdout.write('Login successful.\n'); process.exit(0); }, 50);
} else if (mode === 'fail') {
  setTimeout(() => { process.stderr.write('Login failed: the sign-in was denied in the browser.\n'); process.exit(1); }, 20);
} else if (mode === 'code') {
  process.stdout.write('Paste code here if prompted > ');
  createInterface({ input: process.stdin }).once('line', (line) => {
    if (line.trim() !== 'good-code') {
      process.stderr.write('Login failed: that code is not valid.\n');
      process.exit(1);
    }
    signIn();
    process.stdout.write('Login successful.\n');
    process.exit(0);
  });
} else {
  setInterval(() => {}, 1000);
}
