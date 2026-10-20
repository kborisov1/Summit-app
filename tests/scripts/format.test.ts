import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatSet } from '../../scripts/lib/format';

describe('formatSet', () => {
  it('reproduces the hand-written file style exactly', () => {
    const text = readFileSync('content/sets/sample-001.json', 'utf8');
    expect(formatSet(JSON.parse(text))).toBe(text);
  });
});
