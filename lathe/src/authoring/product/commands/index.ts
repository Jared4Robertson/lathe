// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_PRODUCT } from './add-product.ts';
import { CHANGE_PRODUCT } from './change-product.ts';
import { DECLARE_PRODUCT_KIND } from './declare-product-kind.ts';
import { CHANGE_PRODUCT_KIND } from './change-product-kind.ts';
import { REMOVE_PRODUCT_KIND } from './remove-product-kind.ts';
import { DECLARE_PRODUCT_RELATION } from './declare-product-relation.ts';
import { CHANGE_PRODUCT_RELATION } from './change-product-relation.ts';
import { REMOVE_PRODUCT_RELATION } from './remove-product-relation.ts';
import { ADD_QUESTION } from './add-question.ts';
import { CHANGE_QUESTION } from './change-question.ts';
import { MOVE_QUESTION } from './move-question.ts';
import { REMOVE_QUESTION } from './remove-question.ts';
import { ADD_INTERFACE } from './add-interface.ts';
import { CHANGE_INTERFACE } from './change-interface.ts';
import { REMOVE_INTERFACE } from './remove-interface.ts';

export const PRODUCT_COMMANDS = [
  ADD_PRODUCT,
  CHANGE_PRODUCT,
  DECLARE_PRODUCT_KIND,
  CHANGE_PRODUCT_KIND,
  REMOVE_PRODUCT_KIND,
  DECLARE_PRODUCT_RELATION,
  CHANGE_PRODUCT_RELATION,
  REMOVE_PRODUCT_RELATION,
  ADD_QUESTION,
  CHANGE_QUESTION,
  MOVE_QUESTION,
  REMOVE_QUESTION,
  ADD_INTERFACE,
  CHANGE_INTERFACE,
  REMOVE_INTERFACE,
] as const satisfies readonly AnyCommand[];
