import { describe, expect, it } from 'vitest';
import { sign } from '../src/sign.js';
import { verify, verifyResult } from '../src/verify.js';
import { DEFAULT_TOLERANCE_SECONDS } from '../src/constants.js';

const SECRET = 'whsec_test';
const BODY = '{"id":"evt_1"}';
const TS = 1767225600;
const header = sign(BODY, SECRET, { timestamp: TS });

describe('verify', () => {
  it('accepts a signature it just produced', () => {
    expect(verify(BODY, header, SECRET, { now: TS })).toBe(TS);
  });

  it('rejects a body that changed by one byte', () => {
    const r = verifyResult('{"id":"evt_2"}', header, SECRET, { now: TS });
    expect(r).toMatchObject({ ok: false, code: 'signature_mismatch' });
  });

  it('rejects the wrong secret', () => {
    expect(verifyResult(BODY, header, 'nope', { now: TS })).toMatchObject({
      ok: false,
      code: 'signature_mismatch',
    });
  });

  it('accepts a timestamp exactly at the tolerance edge', () => {
    expect(verify(BODY, header, SECRET, { now: TS + DEFAULT_TOLERANCE_SECONDS })).toBe(TS);
  });

  it('rejects one second past the edge', () => {
    expect(verifyResult(BODY, header, SECRET, { now: TS + DEFAULT_TOLERANCE_SECONDS + 1 })).toMatchObject({
      ok: false,
      code: 'timestamp_out_of_tolerance',
    });
  });

  it('applies the window in both directions', () => {
    expect(verifyResult(BODY, header, SECRET, { now: TS - DEFAULT_TOLERANCE_SECONDS - 1 })).toMatchObject({
      ok: false,
      code: 'timestamp_out_of_tolerance',
    });
  });

  it('skips the window when tolerance is 0', () => {
    expect(verify(BODY, header, SECRET, { now: TS + 10_000_000, toleranceSeconds: 0 })).toBe(TS);
  });

  it('accepts when any one of several secrets matches', () => {
    expect(verify(BODY, header, ['wrong', SECRET], { now: TS })).toBe(TS);
  });

  it('accepts a rotation header against either secret alone', () => {
    const rotated = sign(BODY, ['old', 'new'], { timestamp: TS });
    expect(verify(BODY, rotated, 'old', { now: TS })).toBe(TS);
    expect(verify(BODY, rotated, 'new', { now: TS })).toBe(TS);
  });

  it('reports an empty secret rather than a mismatch', () => {
    expect(verifyResult(BODY, header, '', { now: TS })).toMatchObject({ ok: false, code: 'secret_empty' });
  });

  it('surfaces the parse error code for a malformed header', () => {
    expect(verifyResult(BODY, 'garbage', SECRET, { now: TS })).toMatchObject({
      ok: false,
      code: 'header_malformed',
    });
  });

  it('checks the timestamp before the signature', () => {
    // Wrong body *and* an expired timestamp: the timestamp must win, which is
    // what lets a verifier shed stale load without hashing.
    const r = verifyResult('different', header, SECRET, { now: TS + 100_000 });
    expect(r).toMatchObject({ ok: false, code: 'timestamp_out_of_tolerance' });
  });

  it('verifies a binary body', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const h = sign(bytes, SECRET, { timestamp: TS });
    expect(verify(bytes, h, SECRET, { now: TS })).toBe(TS);
  });
});
