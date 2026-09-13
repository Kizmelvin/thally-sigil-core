import { describe, expect, it } from 'vitest';
import { formatHeader, parseHeader } from '../src/header.js';
import { MAX_SIGNATURES_PER_HEADER } from '../src/constants.js';
import { SigilError } from '../src/errors.js';

const HEX = 'a'.repeat(64);

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof SigilError ? error.code : 'not-a-SigilError';
  }
  return 'no-throw';
}

describe('parseHeader', () => {
  it('reads the timestamp and one signature', () => {
    expect(parseHeader(`t=1767225600,v1=${HEX}`)).toEqual({
      timestamp: 1767225600,
      signatures: [HEX],
    });
  });

  it('keeps several signatures in order', () => {
    const b = 'b'.repeat(64);
    expect(parseHeader(`t=1,v1=${HEX},v1=${b}`).signatures).toEqual([HEX, b]);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseHeader(` t=1 , v1=${HEX} `).timestamp).toBe(1);
  });

  it('ignores keys from schemes it does not know', () => {
    expect(parseHeader(`t=1,v2=zz,v1=${HEX}`).signatures).toEqual([HEX]);
  });

  it.each([
    ['empty string', '', 'header_malformed'],
    ['no timestamp', `v1=${HEX}`, 'header_malformed'],
    ['no signature', 't=1', 'header_no_signatures'],
    ['only an unknown scheme', 't=1,v2=abc', 'header_no_signatures'],
    ['element without =', `t=1,v1`, 'header_malformed'],
    ['empty element', `t=1,,v1=${HEX}`, 'header_malformed'],
    ['two timestamps', `t=1,t=2,v1=${HEX}`, 'header_malformed'],
    ['short digest', 't=1,v1=abc', 'header_malformed'],
    ['upper-case digest', `t=1,v1=${'A'.repeat(64)}`, 'header_malformed'],
    ['non-numeric timestamp', `t=abc,v1=${HEX}`, 'header_timestamp_invalid'],
    ['negative timestamp', `t=-1,v1=${HEX}`, 'header_timestamp_invalid'],
    ['decimal timestamp', `t=1.5,v1=${HEX}`, 'header_timestamp_invalid'],
    ['leading-zero timestamp', `t=012,v1=${HEX}`, 'header_timestamp_invalid'],
  ])('rejects %s', (_label, header, expected) => {
    expect(codeOf(() => parseHeader(header))).toBe(expected);
  });

  it('rejects more signatures than the ceiling allows', () => {
    const many = Array.from({ length: MAX_SIGNATURES_PER_HEADER + 1 }, () => `v1=${HEX}`).join(',');
    expect(codeOf(() => parseHeader(`t=1,${many}`))).toBe('header_too_many_signatures');
  });

  it('accepts exactly the ceiling', () => {
    const many = Array.from({ length: MAX_SIGNATURES_PER_HEADER }, () => `v1=${HEX}`).join(',');
    expect(parseHeader(`t=1,${many}`).signatures).toHaveLength(MAX_SIGNATURES_PER_HEADER);
  });
});

describe('formatHeader', () => {
  it('round-trips through parseHeader', () => {
    const header = `t=99,v1=${HEX}`;
    expect(formatHeader(parseHeader(header))).toBe(header);
  });
});
