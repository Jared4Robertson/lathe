import { rememberPageInSpace } from './commands/remember-page-in-space';

// The Space aggregate's policies: one named reaction each.

/** When a page opens in a space, make it the space's last page (LA-EXP-PO01): hears Page opened (LA-EXP-EV01). */
export function onPageOpenedRememberPageInSpace(product: string | null, address: string): void {
  if (product) rememberPageInSpace({ product, address });
}
