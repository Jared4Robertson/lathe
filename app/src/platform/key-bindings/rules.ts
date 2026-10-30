import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { RESERVED, clashes, customizable, formatBinding, normalizeBinding } from '../../shell/keymap';
import { boundCommands, commandOf, type KeyBindings } from './model';

/**
 * What breaks the Key bindings' rules: a shortcut that is not the app's to bind (shortcut-can-be-bound, LA-PLT-INV43),
 * a key the browser or the system keeps (key-not-kept-by-browser, LA-PLT-INV41), a shortcut left without a key that
 * was not unbound on purpose (shortcut-keeps-a-key, LA-PLT-INV42), and two shortcuts on one key, or a sequence and the
 * key it starts with, where both apply (key-free-where-it-applies, LA-PLT-INV40), each naming the other shortcut.
 */
export function keyBindingsProblems(bindings: KeyBindings, mac: boolean): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
  const shown = (key: string) => formatBinding(key, mac);
  for (const b of bindings.changed) {
    const command = commandOf(b.shortcut);
    if (!command || !customizable(command)) {
      problems.push({ rule: 'shortcut-can-be-bound', message: command ? `"${command.title}" keeps its own keys: ${command.browser ? 'the browser' : 'its control'} handles them.` : `There is no shortcut ${b.shortcut}.` });
      continue;
    }
    for (const k of b.keys) if (reserved.has(normalizeBinding(k, mac))) problems.push({ rule: 'key-not-kept-by-browser', message: `${shown(k)} belongs to the browser or the system, so "${command.title}" cannot take it.` });
    if (b.keys.length === 0 && !b.unbound) problems.push({ rule: 'shortcut-keeps-a-key', message: `"${command.title}" would have no key. Remove its last key on purpose to leave it without one.` });
  }
  for (const c of clashes(boundCommands(bindings, mac), mac)) {
    problems.push({
      rule: 'key-free-where-it-applies',
      message: c.binding === c.other
        ? `${shown(c.binding)} would be the key of both "${c.a.title}" and "${c.b.title}".`
        : `${shown(c.binding)} ("${c.a.title}") and ${shown(c.other)} ("${c.b.title}") start alike, so one would never run.`,
    });
  }
  return problems;
}

/** Refuses Key bindings that break a rule, with every reason. */
export const holdToRules = (bindings: KeyBindings, mac: boolean) => refuseBroken(keyBindingsProblems(bindings, mac));
