import type { PromptSet } from './types';

// Bundled at build time (architecture "Content and Data Model").
const modules = import.meta.glob<PromptSet>('../../content/sets/*.json', {
  eager: true,
  import: 'default',
});

export const promptSets: readonly PromptSet[] = Object.values(modules);
