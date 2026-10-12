const LEADING_ARTICLE = /^the /;

/**
 * Normalizes player input and content strings to a comparable key
 * (architecture "Answer Matching", step 1).
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');
}
