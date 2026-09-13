import { SigilError } from './errors.js';
import { verify, type VerifyOptions } from './verify.js';

/** A verified webhook, with its body already decoded. */
export interface SigilEvent<T = unknown> {
  /** Unix seconds the sender stamped the signature with. */
  timestamp: number;
  /** The decoded JSON body. */
  payload: T;
}

/**
 * Verify a request and decode its body in one call.
 *
 * This is the shape almost every receiver actually wants, and doing it here
 * removes the most common way to get verification wrong: parsing the body
 * first, then signing or checking the re-encoded result. The raw bytes are
 * verified, and only then decoded.
 *
 * The type parameter is a convenience for callers, not a validation step —
 * nothing checks that the payload matches `T`.
 */
export function constructEvent<T = unknown>(
  body: string | Uint8Array,
  header: string,
  secret: string | readonly string[],
  options: VerifyOptions = {},
): SigilEvent<T> {
  const timestamp = verify(body, header, secret, options);
  const text = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');

  let payload: T;
  try {
    payload = JSON.parse(text) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SigilError('payload_not_json', `Body verified, but is not valid JSON: ${reason}`);
  }
  return { timestamp, payload };
}
