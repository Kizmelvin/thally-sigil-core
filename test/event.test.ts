import { describe, expect, it } from 'vitest';
import { constructEvent } from '../src/event.js';
import { sign } from '../src/sign.js';
import { SigilError } from '../src/errors.js';

const SECRET = 'whsec_test';
const TS = 1767225600;

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof SigilError ? error.code : 'not-a-SigilError';
  }
  return 'no-throw';
}

describe('constructEvent', () => {
  it('returns the decoded payload and the timestamp', () => {
    const body = '{"id":"evt_1","type":"invoice.paid"}';
    const header = sign(body, SECRET, { timestamp: TS });
    expect(constructEvent(body, header, SECRET, { now: TS })).toEqual({
      timestamp: TS,
      payload: { id: 'evt_1', type: 'invoice.paid' },
    });
  });

  it('decodes a Uint8Array body as utf-8', () => {
    const bytes = new TextEncoder().encode('{"ok":true}');
    const header = sign(bytes, SECRET, { timestamp: TS });
    expect(constructEvent(bytes, header, SECRET, { now: TS }).payload).toEqual({ ok: true });
  });

  it('verifies before parsing, so a bad signature never reaches JSON.parse', () => {
    const header = sign('{"a":1}', SECRET, { timestamp: TS });
    expect(codeOf(() => constructEvent('not json at all', header, SECRET, { now: TS }))).toBe(
      'signature_mismatch',
    );
  });

  it('reports payload_not_json when a correctly signed body is not JSON', () => {
    const body = 'plain text';
    const header = sign(body, SECRET, { timestamp: TS });
    expect(codeOf(() => constructEvent(body, header, SECRET, { now: TS }))).toBe('payload_not_json');
  });

  it('passes verification options through', () => {
    const body = '{"a":1}';
    const header = sign(body, SECRET, { timestamp: TS });
    expect(codeOf(() => constructEvent(body, header, SECRET, { now: TS + 10_000 }))).toBe(
      'timestamp_out_of_tolerance',
    );
    expect(constructEvent(body, header, SECRET, { now: TS + 10_000, toleranceSeconds: 0 }).payload).toEqual({
      a: 1,
    });
  });

  it('accepts a JSON scalar body', () => {
    const header = sign('42', SECRET, { timestamp: TS });
    expect(constructEvent<number>('42', header, SECRET, { now: TS }).payload).toBe(42);
  });
});
