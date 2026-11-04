import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { useAnnounce } from '../shell/commands';
import type { ChatBridge, SignInMethod, SignInState } from './types';

// Signing the chat's Claude Code in from the panel (LA-PLT-UC30, LA-V99-R06): when it is not signed in, before a
// session or when a turn says so, the panel offers Sign in (the Owner's Claude subscription) and, quieter, a Console
// account. The shell runs Claude Code's own sign-in, which opens the browser; the panel says to finish there, links the
// sign-in page once Claude Code gives it, takes the code if it asks for one, and offers Cancel. When it ends, the panel
// shows the chat again, or why it failed with Try again. The panel never sees a credential.

const IDLE: SignInState = { status: 'idle', method: null, url: null, asksForCode: false, problem: null };

/** How the sign-in goes, as the shell tells every window, starting from what the session list said. */
export function useSignIn(bridge: ChatBridge, initial: SignInState | undefined): SignInState {
  const [state, setState] = useState<SignInState>(initial ?? IDLE);
  useEffect(() => { if (initial) setState(initial); }, [initial]);
  useEffect(() => bridge.onSignIn(setState), [bridge]);
  return state;
}

/** Only an https link Claude Code printed is offered to open. */
const safeLink = (url: string | null) => (url && /^https:\/\//.test(url) ? url : null);

export function SignInNotice({ bridge, state }: { bridge: ChatBridge; state: SignInState }) {
  const announce = useAnnounce();
  const [code, setCode] = useState('');
  const codeBox = useRef<HTMLInputElement>(null);
  const asks = state.status === 'waiting' && state.asksForCode;
  useEffect(() => { if (asks) codeBox.current?.focus(); }, [asks]);
  useEffect(() => { if (state.status !== 'waiting') setCode(''); }, [state.status]);

  const start = async (method: SignInMethod) => {
    if (!(await bridge.signIn(method))) announce('Claude Code could not start signing in.');
  };
  const sendCode = async () => {
    if (!code.trim()) return;
    if (await bridge.giveSignInCode(code)) { setCode(''); announce('Code sent'); } else announce('The code could not be sent.');
  };
  const cancel = async () => {
    if (await bridge.cancelSignIn()) announce('Signing in canceled');
  };

  if (state.status === 'waiting' || state.status === 'checking') {
    const link = safeLink(state.url);
    return (
      <div className="chat-missing chat-sign-in" role="status" aria-label="Signing in to Claude Code">
        <p>{state.status === 'checking' ? 'Checking that Claude Code is signed in…' : <><strong>Finish signing in in your browser.</strong> Claude Code opened its sign-in page there.</>}</p>
        {state.status === 'waiting' && link && (
          <p>Not there? <a href={link} target="_blank" rel="noreferrer">Open the sign-in page</a></p>
        )}
        {asks && (
          <form className="chat-sign-in-code" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <label htmlFor="chat-sign-in-code">Code from the browser</label>
            <input ref={codeBox} id="chat-sign-in-code" className="chat-sign-in-input" type="text" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="primary" type="submit" disabled={!code.trim()}>Send code</Button>
          </form>
        )}
        {state.status === 'waiting' && (
          <div className="chat-sign-in-actions">
            <Button onClick={() => void cancel()}>Cancel</Button>
          </div>
        )}
      </div>
    );
  }

  const failed = state.status === 'failed';
  return (
    <div className="chat-missing chat-sign-in" role="alert">
      <p>{failed ? <>Signing in did not finish: {state.problem}</> : 'Claude Code is not signed in, so it cannot answer yet.'}</p>
      <div className="chat-sign-in-actions">
        <Button variant="primary" onClick={() => void start(failed && state.method ? state.method : 'claudeai')}>{failed ? 'Try again' : 'Sign in'}</Button>
        {!(failed && state.method === 'console') && <Button onClick={() => void start('console')}>Use an API key account instead</Button>}
        {failed && state.method === 'console' && <Button onClick={() => void start('claudeai')}>Sign in with a Claude account</Button>}
      </div>
    </div>
  );
}
