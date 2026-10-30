import { GET_ERD } from '../../lathe/src/exploring/erd/queries';
import type { ErdMap } from '../../lathe/src/exploring/erd/read-model';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { readViewOf, type ServedData } from './read-view';

// The ERD read's answer for the served data, as the test server answers GET /api/erd/get-erd: the map the ERD stage
// lays out and draws.

/** The product's ERD map over the data. */
export const erdOf = (data: ServedData, product: string): ErdMap => answerQuery(readViewOf(data), GET_ERD, { product_id: product }) as ErdMap;
