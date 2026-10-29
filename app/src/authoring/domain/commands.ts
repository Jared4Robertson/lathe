// The Domain aggregate's commands as the app sends them (LA-AUT-A4): each route, POST /api/domain/<command>, with
// its input, the type its command file declares. The domain's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddCapability } from '../../../../lathe/src/authoring/domain/commands/add-capability';
import type { AddDomain } from '../../../../lathe/src/authoring/domain/commands/add-domain';
import type { AddDomainService } from '../../../../lathe/src/authoring/domain/commands/add-domain-service';
import type { AddDomainServiceTest } from '../../../../lathe/src/authoring/domain/commands/add-domain-service-test';
import type { AddRepository } from '../../../../lathe/src/authoring/domain/commands/add-repository';
import type { AddService } from '../../../../lathe/src/authoring/domain/commands/add-service';
import type { AddTerm } from '../../../../lathe/src/authoring/domain/commands/add-term';
import type { ChangeCapability } from '../../../../lathe/src/authoring/domain/commands/change-capability';
import type { ChangeDomain } from '../../../../lathe/src/authoring/domain/commands/change-domain';
import type { ChangeDomainService } from '../../../../lathe/src/authoring/domain/commands/change-domain-service';
import type { ChangeDomainServiceTest } from '../../../../lathe/src/authoring/domain/commands/change-domain-service-test';
import type { ChangeRepository } from '../../../../lathe/src/authoring/domain/commands/change-repository';
import type { ChangeService } from '../../../../lathe/src/authoring/domain/commands/change-service';
import type { ChangeTerm } from '../../../../lathe/src/authoring/domain/commands/change-term';
import type { RemoveCapability } from '../../../../lathe/src/authoring/domain/commands/remove-capability';
import type { RemoveDomain } from '../../../../lathe/src/authoring/domain/commands/remove-domain';
import type { RemoveDomainService } from '../../../../lathe/src/authoring/domain/commands/remove-domain-service';
import type { RemoveDomainServiceTest } from '../../../../lathe/src/authoring/domain/commands/remove-domain-service-test';
import type { RemoveRepository } from '../../../../lathe/src/authoring/domain/commands/remove-repository';
import type { RemoveService } from '../../../../lathe/src/authoring/domain/commands/remove-service';
import type { RemoveTerm } from '../../../../lathe/src/authoring/domain/commands/remove-term';

/** Each command's route, with its input. */
export interface DomainCommands {
  '/api/domain/add-capability': AddCapability;
  '/api/domain/add-domain': AddDomain;
  '/api/domain/add-domain-service': AddDomainService;
  '/api/domain/add-domain-service-test': AddDomainServiceTest;
  '/api/domain/add-repository': AddRepository;
  '/api/domain/add-service': AddService;
  '/api/domain/add-term': AddTerm;
  '/api/domain/change-capability': ChangeCapability;
  '/api/domain/change-domain': ChangeDomain;
  '/api/domain/change-domain-service': ChangeDomainService;
  '/api/domain/change-domain-service-test': ChangeDomainServiceTest;
  '/api/domain/change-repository': ChangeRepository;
  '/api/domain/change-service': ChangeService;
  '/api/domain/change-term': ChangeTerm;
  '/api/domain/remove-capability': RemoveCapability;
  '/api/domain/remove-domain': RemoveDomain;
  '/api/domain/remove-domain-service': RemoveDomainService;
  '/api/domain/remove-domain-service-test': RemoveDomainServiceTest;
  '/api/domain/remove-repository': RemoveRepository;
  '/api/domain/remove-service': RemoveService;
  '/api/domain/remove-term': RemoveTerm;
}

export type DomainRoute = keyof DomainCommands;

/** Sends one Domain command through the shell's writer: its route and its input, typed by the route. */
export const sendDomain = <R extends DomainRoute>(writer: Writer, route: R, input: DomainCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
