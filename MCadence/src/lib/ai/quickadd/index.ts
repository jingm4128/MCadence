/**
 * Quick Add with AI Module
 *
 * Re-exports all quick add related types and functions.
 */

export * from './types';
export {
  isQuickAddEnabled,
  buildCategoryPalette,
  generateQuickAddProposals,
} from './generate';
