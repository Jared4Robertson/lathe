import type { TestDataSetPage } from '../../../../lathe/src/authoring/test-data-set/read-model';
import { useRead, type Read } from '../../record/read';

// The Test data set aggregate's reads as its page makes them (LA-AUT-RM37): a test data set as its page shows it
// (get-test-data-set), and the next free ID for a test data set of a domain (next-id).

/** The test data set's page: read again whenever the data is (`version`). */
export const useTestDataSet = (id: string, version: unknown): Read<TestDataSetPage> => useRead<TestDataSetPage>('/api/test-data-set/get-test-data-set', { id }, version);

/** The next free ID for a test data set of the domain, as the Add form suggests it. */
export const useNextTestDataSetId = (domain: string, version: unknown): Read<string> => useRead<string>('/api/test-data-set/next-id', { domain_id: domain }, version);
