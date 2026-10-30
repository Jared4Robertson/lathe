import { refuseBroken } from '../../shell/prefs';
import { SINCES } from '../../changes/changes';
import { CARD_MAX, CARD_MIN, CHAT_MAX, CHAT_MIN, LAYOUTS, type SessionSettings } from './model';

const within = (w: number | null, min: number, max: number) => w === null || (Number.isInteger(w) && w >= min && w <= max);

/** What breaks the Session settings' rules: a width outside its limits (LA-EXP-INV30), a layout or baseline the app does not have (LA-EXP-INV31). */
export function sessionSettingsProblems(settings: SessionSettings): string[] {
  const problems: string[] = [];
  if (!within(settings.card.width, CARD_MIN, CARD_MAX)) problems.push(`The wiki card's width ${settings.card.width} is outside ${CARD_MIN}–${CARD_MAX} px.`);
  if (!within(settings.chat.width, CHAT_MIN, CHAT_MAX)) problems.push(`The chat's width ${settings.chat.width} is outside ${CHAT_MIN}–${CHAT_MAX} px.`);
  if (!LAYOUTS.includes(settings.graph.layout)) problems.push(`The graph has no layout "${settings.graph.layout}".`);
  if (!SINCES.includes(settings.changes.since)) problems.push(`The Changes lens has no baseline "${settings.changes.since}".`);
  return problems;
}

/** Refuses settings that break a rule, with every reason. */
export const holdToRules = (settings: SessionSettings) => refuseBroken(sessionSettingsProblems(settings));
