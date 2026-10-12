import { describe, expect, it } from 'vitest';
import { normalize } from '../../src/matching/normalize';

describe('normalize', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalize('  Golden   Retriever ')).toBe('golden retriever');
  });

  it('strips diacritics', () => {
    expect(normalize('São Tomé and Príncipe')).toBe('sao tome and principe');
    expect(normalize('Côte d’Ivoire')).toBe('cote divoire');
  });

  it('drops apostrophes and turns other punctuation into spaces', () => {
    expect(normalize("A Midsummer Night's Dream")).toBe('a midsummer nights dream');
    expect(normalize('Hurdy-gurdy')).toBe('hurdy gurdy');
    expect(normalize('Hamlet!!!')).toBe('hamlet');
  });

  it('treats & as "and"', () => {
    expect(normalize('Antony & Cleopatra')).toBe('antony and cleopatra');
  });

  it('drops a leading "the"', () => {
    expect(normalize('The Tempest')).toBe('tempest');
    expect(normalize('theremin')).toBe('theremin');
  });

  it('returns an empty string for punctuation-only input', () => {
    expect(normalize(' ?! ')).toBe('');
  });
});
