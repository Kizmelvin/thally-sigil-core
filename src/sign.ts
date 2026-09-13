import { createHmac } from 'node:crypto';
import { SIGNATURE_VERSION } from './constants.js';
import { SigilError } from './errors.js';
import { formatHeader } from './header.js';

export interface SignOptions {
  /**
   * Unix seconds to stamp the signature with. Defaults to the current time.
   * Pass it explicitly to make a test deterministic.
   */
  timestamp?: number;
}

/**
 * The exact bytes that get signed: the timestamp, a single dot, then the raw
 * body.
 *
 * Binding the timestamp into the signed material is what makes the timestamp
 * tamper-evident. If it were carried alongside an unbound signature, an
 * attacker could replay an old body with a fresh timestamp and it would still
 * verify.
 *
 * The body is used verbatim — never re-serialised. Two JSON encoders disagree
 * about key order and whitespace, so signing a re-encoded body produces a
 * digest the receiver cannot reproduce.
 */
export function signingPayload(timestamp: number, body: string | Uint8Array): Uint8Array {
  const prefix = Buffer.from(`${timestamp}.`, 'utf8');
  const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
  return Buffer.concat([prefix, bytes]);
}

/** Lower-case hex HMAC-SHA256 of `signingPayload(timestamp, body)`. */
export function computeSignature(timestamp: number, body: string | Uint8Array, secret: string): string {
  if (secret === '') {
    throw new SigilError('secret_empty', 'Signing secret is empty.');
  }
  return createHmac('sha256', secret).update(signingPayload(timestamp, body)).digest('hex');
}

/**
 * Produce a `Sigil-Signature` header value for `body`.
 *
 * Passing several secrets emits one `v1=` element per secret, in the order
 * given. That is the rotation path: sign with both the outgoing and incoming
 * secret until every receiver has the new one.
 */
export function sign(
  body: string | Uint8Array,
  secret: string | readonly string[],
  options: SignOptions = {},
): string {
  const secrets = typeof secret === 'string' ? [secret] : [...secret];
  if (secrets.length === 0) {
    throw new SigilError('secret_empty', 'No signing secret was given.');
  }

  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new SigilError('header_timestamp_invalid', `Timestamp ${timestamp} is not whole, non-negative seconds.`);
  }

  return formatHeader({
    timestamp,
    signatures: secrets.map((s) => computeSignature(timestamp, body, s)),
  });
}

export { SIGNATURE_VERSION };
