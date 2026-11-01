// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { NAME_PROVIDER } from './name-provider.ts';
import { REMOVE_PROVIDER } from './remove-provider.ts';

export const PROVISION_COMMANDS = [
  NAME_PROVIDER,
  REMOVE_PROVIDER,
] as const satisfies readonly AnyCommand[];
