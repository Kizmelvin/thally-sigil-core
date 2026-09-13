/**
 * Sigil — webhook signing, verification and delivery-retry policy.
 *
 * The signature format and the retry schedule are both defined here so that
 * senders, receivers and the CLI cannot drift apart on them.
 */

export {
  DEFAULT_TOLERANCE_SECONDS,
  HEADER_NAME,
  MAX_SIGNATURES_PER_HEADER,
  SIGNATURE_VERSION,
} from './constants.js';

export { SIGIL_ERROR_CODES, SigilError, type SigilErrorCode } from './errors.js';

export { formatHeader, parseHeader, type ParsedHeader } from './header.js';

export { computeSignature, sign, signingPayload, type SignOptions } from './sign.js';

export { verify, verifyResult, type VerifyOptions, type VerifyResult } from './verify.js';

export { constructEvent, type SigilEvent } from './event.js';

export {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  nextDelayMs,
  retrySchedule,
  totalRetryWindowMs,
  type BackoffOptions,
} from './backoff.js';
