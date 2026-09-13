/**
 * Values that define the wire format. Changing any of them is a breaking
 * change for every service that already verifies Sigil signatures, so they
 * live here rather than being spelled out at each call site.
 */

/** Scheme version written into, and required by, every signature header. */
export const SIGNATURE_VERSION = 'v1';

/** HTTP header the signature is transmitted in. */
export const HEADER_NAME = 'Sigil-Signature';

/**
 * How far a signature's timestamp may be from the verifier's clock.
 *
 * Five minutes is a deliberate compromise: long enough to survive a slow
 * network and a little clock skew, short enough that a captured request is
 * not replayable for the rest of the day.
 */
export const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Upper bound on signatures in one header. A header carries more than one
 * only while a secret is being rotated, so the ceiling is low on purpose —
 * an unbounded list would let a caller force arbitrarily many HMAC
 * computations per request.
 */
export const MAX_SIGNATURES_PER_HEADER = 8;
