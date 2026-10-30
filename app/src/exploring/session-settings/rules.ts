import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { SINCES } from '../../changes/changes';
import { CARD_MAX, CARD_MIN, CHAT_MAX, CHAT_MIN, LAYOUTS, type SessionSettings } from './model';

const within = (w: number | null, min: number, max: number) => w === null || (Number.isInteger(w) && w >= min && w <= max);

/**
 * What breaks the Session settings' rule (session-settings-known, LA-EXP-INV30): a width outside its limits, or a
 * layout or baseline the app does not have.
 */
export function sessionSettingsProblems(settings: SessionSettings): RuleProblem[] {
  const problems: RuleProblem[] = [];
  if (!within(settings.card.width, CARD_MIN, CARD_MAX)) problems.push({ rule: 'session-settings-known', message: `The wiki card's width ${settings.card.width} is outside ${CARD_MIN}–${CARD_MAX} px.` });
  if (!within(settings.chat.width, CHAT_MIN, CHAT_MAX)) problems.push({ rule: 'session-settings-known', message: `The chat's width ${settings.chat.width} is outside ${CHAT_MIN}–${CHAT_MAX} px.` });
  if (!LAYOUTS.includes(settings.graph.layout)) problems.push({ rule: 'session-settings-known', message: `The graph has no layout "${settings.graph.layout}".` });
  if (!SINCES.includes(settings.changes.since)) problems.push({ rule: 'session-settings-known', message: `Highlight changes has no baseline "${settings.changes.since}".` });
  return problems;
}

/** Refuses settings that break a rule, with every reason. */
export const holdToRules = (settings: SessionSettings) => refuseBroken(sessionSettingsProblems(settings));
