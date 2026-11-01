// Generated from data/ by `npm run generate`. Do not edit.
// The pattern-following commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const PATTERN_FOLLOWING_FIELDS = {
  '/api/pattern-following/follow-pattern': {
    follower_id: { kind: 'column', table: 'setting_value', column: 'follower_id', required: true, clearable: false },
    pattern_id: { kind: 'column', table: 'setting_value', column: 'pattern_id', required: true, clearable: false },
    setting_values: { kind: 'parts', table: 'setting_value', columns: ['setting', 'value'], description: 'Each of the pattern\'s settings with its value.', required: false, clearable: false },
  },
  '/api/pattern-following/change-setting-values': {
    follower_id: { kind: 'column', table: 'setting_value', column: 'follower_id', required: true, clearable: false },
    pattern_id: { kind: 'column', table: 'setting_value', column: 'pattern_id', required: true, clearable: false },
    setting_values: { kind: 'parts', table: 'setting_value', columns: ['setting', 'value'], description: 'Each of the pattern\'s settings with its value. Replaces the list.', required: true, clearable: false },
  },
  '/api/pattern-following/stop-following-pattern': {
    follower_id: { kind: 'column', table: 'setting_value', column: 'follower_id', required: true, clearable: false },
    pattern_id: { kind: 'column', table: 'setting_value', column: 'pattern_id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
