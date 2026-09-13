import { timingSafeEqual } from 'node:crypto';
import { DEFAULT_TOLERANCE_SECONDS } from './constants.js';
import { SigilError, type SigilErrorCode } from './errors.js';
import { parseHeader } from './header.js';
import { computeSignature } from './sign.js';

export interface VerifyOptions {
  /**
   * Maximum absolute difference, in seconds, between the header's timestamp
   * and `now`. Defaults to {@link DEFAULT_TOLERANCE_SECONDS}.
   *
   * `0` disables the window entirely and accepts any timestamp; use it only
   * when replay is prevented some other way.
   */
  toleranceSeconds?: number;
  /** Unix seconds to check the timestamp against. Defaults to the clock. */
  now?: number;
}

export type VerifyResult = { ok: true; timestamp: number } | { ok: false; code: SigilErrorCode; message: string };

/**
 * Check `header` against `body`.
 *
 * Succeeds when the header parses, its timestamp is inside the tolerance
 * window, and at least one of its signatures matches one of `secrets`.
 * Throws {@link SigilError} otherwise.
 *
 * The timestamp is checked before any HMAC is computed, so a flood of stale
 * requests costs a comparison each rather than a hash each.
 */
export function verify(
  body: string | Uint8Array,
  header: string,
  secret: string | readonly string[],
  options: VerifyOptions = {},
): number {
  const secrets = typeof secret === 'string' ? [secret] : [...secret];
  if (secrets.length === 0 || secrets.some((s) => s === '')) {
    throw new SigilError('secret_empty', 'A verification secret is empty.');
  }

  const parsed = parseHeader(header);
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  if (tolerance > 0) {
    const drift = Math.abs(now - parsed.timestamp);
    if (drift > tolerance) {
      throw new SigilError(
        'timestamp_out_of_tolerance',
        `Timestamp is ${drift}s from now; the limit is ${tolerance}s.`,
      );
    }
  }

  // Every candidate is compared even after a match is found, so the work done
  // does not reveal which secret or which signature was the matching one.
  let matched = false;
  for (const candidate of secrets) {
    const expected = computeSignature(parsed.timestamp, body, candidate);
    for (const supplied of parsed.signatures) {
      if (constantTimeEquals(expected, supplied)) matched = true;
    }
  }

  if (!matched) {
    throw new SigilError('signature_mismatch', 'No signature in the header matched the body.');
  }
  return parsed.timestamp;
}

/** {@link verify}, but returning the outcome instead of throwing. */
export function verifyResult(
  body: string | Uint8Array,
  header: string,
  secret: string | readonly string[],
  options: VerifyOptions = {},
): VerifyResult {
  try {
    return { ok: true, timestamp: verify(body, header, secret, options) };
  } catch (error) {
    if (error instanceof SigilError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

/**
 * Compare two hex digests without leaking, through timing, how many leading
 * characters agreed.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a
 * signal, so unequal lengths are turned into a constant-time `false` by
 * comparing the value against itself and discarding the result.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
