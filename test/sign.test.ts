import { describe, expect, it } from 'vitest';
import { computeSignature, sign, signingPayload } from '../src/sign.js';
import { SigilError } from '../src/errors.js';

const SECRET = 'whsec_test';
const BODY = '{"id":"evt_1","type":"invoice.paid"}';
const TS = 1767225600;

describe('signingPayload', () => {
  it('joins the timestamp and body with a single dot', () => {
    expect(Buffer.from(signingPayload(TS, 'abc')).toString('utf8')).toBe(`${TS}.abc`);
  });

  it('treats a string body and its utf-8 bytes identically', () => {
    const fromString = signingPayload(TS, BODY);
    const fromBytes = signingPayload(TS, new TextEncoder().encode(BODY));
    expect(Buffer.from(fromString).equals(Buffer.from(fromBytes))).toBe(true);
  });

  it('does not re-serialise the body, so whitespace changes the digest', () => {
    const compact = computeSignature(TS, '{"a":1}', SECRET);
    const spaced = computeSignature(TS, '{ "a": 1 }', SECRET);
    expect(compact).not.toBe(spaced);
  });
});

describe('sign', () => {
  it('is deterministic for a fixed timestamp', () => {
    expect(sign(BODY, SECRET, { timestamp: TS })).toBe(sign(BODY, SECRET, { timestamp: TS }));
  });

  it('emits t= followed by one v1= per secret, in order', () => {
    const header = sign(BODY, ['a', 'b'], { timestamp: TS });
    expect(header).toBe(
      `t=${TS},v1=${computeSignature(TS, BODY, 'a')},v1=${computeSignature(TS, BODY, 'b')}`,
    );
  });

  it('produces a 64-character lower-case hex digest', () => {
    expect(computeSignature(TS, BODY, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the digest when the timestamp changes', () => {
    expect(computeSignature(TS, BODY, SECRET)).not.toBe(computeSignature(TS + 1, BODY, SECRET));
  });

  it('rejects an empty secret', () => {
    expect(() => sign(BODY, '', { timestamp: TS })).toThrow(SigilError);
    expect(() => sign(BODY, '', { timestamp: TS })).toThrow(/empty/i);
  });

  it('rejects a fractional timestamp', () => {
    expect(() => sign(BODY, SECRET, { timestamp: 1.5 })).toThrow(SigilError);
  });
});
