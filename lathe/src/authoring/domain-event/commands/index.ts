// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_DOMAIN_EVENT } from './add-domain-event.ts';
import { CHANGE_DOMAIN_EVENT } from './change-domain-event.ts';
import { REMOVE_DOMAIN_EVENT } from './remove-domain-event.ts';
import { ADD_EVENT_TYPE } from './add-event-type.ts';
import { CHANGE_EVENT_TYPE } from './change-event-type.ts';
import { REMOVE_EVENT_TYPE } from './remove-event-type.ts';

export const DOMAIN_EVENT_COMMANDS = [
  ADD_DOMAIN_EVENT,
  CHANGE_DOMAIN_EVENT,
  REMOVE_DOMAIN_EVENT,
  ADD_EVENT_TYPE,
  CHANGE_EVENT_TYPE,
  REMOVE_EVENT_TYPE,
] as const satisfies readonly AnyCommand[];
