// The Product aggregate's commands as the app sends them (LA-AUT-A1): each route, POST /api/product/<command>, with its
// input, the type its command file declares. The product's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions (PRODUCT_COMMANDS), one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddInterface } from '../../../../lathe/src/authoring/product/commands/add-interface';
import type { AddProduct } from '../../../../lathe/src/authoring/product/commands/add-product';
import type { AddQuestion } from '../../../../lathe/src/authoring/product/commands/add-question';
import type { ChangeInterface } from '../../../../lathe/src/authoring/product/commands/change-interface';
import type { ChangeProductKind } from '../../../../lathe/src/authoring/product/commands/change-product-kind';
import type { ChangeProductRelation } from '../../../../lathe/src/authoring/product/commands/change-product-relation';
import type { ChangeProduct } from '../../../../lathe/src/authoring/product/commands/change-product';
import type { ChangeQuestion } from '../../../../lathe/src/authoring/product/commands/change-question';
import type { DeclareProductKind } from '../../../../lathe/src/authoring/product/commands/declare-product-kind';
import type { DeclareProductRelation } from '../../../../lathe/src/authoring/product/commands/declare-product-relation';
import type { MoveQuestion } from '../../../../lathe/src/authoring/product/commands/move-question';
import type { RemoveInterface } from '../../../../lathe/src/authoring/product/commands/remove-interface';
import type { RemoveProductKind } from '../../../../lathe/src/authoring/product/commands/remove-product-kind';
import type { RemoveProductRelation } from '../../../../lathe/src/authoring/product/commands/remove-product-relation';
import type { RemoveQuestion } from '../../../../lathe/src/authoring/product/commands/remove-question';

/** Each command's route, with its input. */
export interface ProductCommands {
  '/api/product/add-interface': AddInterface;
  '/api/product/add-product': AddProduct;
  '/api/product/add-question': AddQuestion;
  '/api/product/change-interface': ChangeInterface;
  '/api/product/change-product-kind': ChangeProductKind;
  '/api/product/change-product-relation': ChangeProductRelation;
  '/api/product/change-product': ChangeProduct;
  '/api/product/change-question': ChangeQuestion;
  '/api/product/declare-product-kind': DeclareProductKind;
  '/api/product/declare-product-relation': DeclareProductRelation;
  '/api/product/move-question': MoveQuestion;
  '/api/product/remove-interface': RemoveInterface;
  '/api/product/remove-product-kind': RemoveProductKind;
  '/api/product/remove-product-relation': RemoveProductRelation;
  '/api/product/remove-question': RemoveQuestion;
}

export type ProductRoute = keyof ProductCommands;

/** Sends one Product command through the shell's writer: its route and its input, typed by the route. */
export const sendProduct = <R extends ProductRoute>(writer: Writer, route: R, input: ProductCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
