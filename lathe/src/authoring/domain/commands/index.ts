// The Domain aggregate's commands, as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_DOMAIN } from './add-domain.ts';
import { CHANGE_DOMAIN } from './change-domain.ts';
import { REMOVE_DOMAIN } from './remove-domain.ts';
import { ADD_CAPABILITY } from './add-capability.ts';
import { CHANGE_CAPABILITY } from './change-capability.ts';
import { REMOVE_CAPABILITY } from './remove-capability.ts';
import { ADD_TERM } from './add-term.ts';
import { CHANGE_TERM } from './change-term.ts';
import { REMOVE_TERM } from './remove-term.ts';
import { ADD_DOMAIN_SERVICE } from './add-domain-service.ts';
import { CHANGE_DOMAIN_SERVICE } from './change-domain-service.ts';
import { REMOVE_DOMAIN_SERVICE } from './remove-domain-service.ts';
import { ADD_REPOSITORY } from './add-repository.ts';
import { CHANGE_REPOSITORY } from './change-repository.ts';
import { REMOVE_REPOSITORY } from './remove-repository.ts';
import { ADD_SERVICE } from './add-service.ts';
import { CHANGE_SERVICE } from './change-service.ts';
import { REMOVE_SERVICE } from './remove-service.ts';
import { ADD_DOMAIN_SERVICE_TEST } from './add-domain-service-test.ts';
import { CHANGE_DOMAIN_SERVICE_TEST } from './change-domain-service-test.ts';
import { REMOVE_DOMAIN_SERVICE_TEST } from './remove-domain-service-test.ts';

export const DOMAIN_COMMANDS: readonly AnyCommand[] = [
  ADD_DOMAIN,
  CHANGE_DOMAIN,
  REMOVE_DOMAIN,
  ADD_CAPABILITY,
  CHANGE_CAPABILITY,
  REMOVE_CAPABILITY,
  ADD_TERM,
  CHANGE_TERM,
  REMOVE_TERM,
  ADD_DOMAIN_SERVICE,
  CHANGE_DOMAIN_SERVICE,
  REMOVE_DOMAIN_SERVICE,
  ADD_REPOSITORY,
  CHANGE_REPOSITORY,
  REMOVE_REPOSITORY,
  ADD_SERVICE,
  CHANGE_SERVICE,
  REMOVE_SERVICE,
  ADD_DOMAIN_SERVICE_TEST,
  CHANGE_DOMAIN_SERVICE_TEST,
  REMOVE_DOMAIN_SERVICE_TEST,
];
