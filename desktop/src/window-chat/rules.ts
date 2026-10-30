// The Window chat's rule (one-chat-per-window, LA-PLT-INV45): each window has one chat, kept under its folder's full
// path, and one session runs in one chat only.
import path from 'node:path';
import { holdTo, type RuleProblem } from '../rules.ts';
import type { WindowChats } from './model.ts';

export function windowChatProblems(chats: WindowChats): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const sessions = new Set<unknown>();
  for (const [folder, chat] of chats.open) {
    if (chat.folder !== folder) problems.push({ rule: 'one-chat-per-window', message: `The chat of ${chat.folder} is kept under ${folder}.` });
    if (path.resolve(folder) !== folder) problems.push({ rule: 'one-chat-per-window', message: `The chat of ${folder} is not kept under its full path.` });
    if (chat.session && sessions.has(chat.session)) problems.push({ rule: 'one-chat-per-window', message: `The chat of ${folder} runs another window's session.` });
    if (chat.session) sessions.add(chat.session);
  }
  return problems;
}

/** Refuses chats that break a rule, with every reason. */
export function holdToRules(chats: WindowChats): void {
  holdTo(windowChatProblems(chats));
}
