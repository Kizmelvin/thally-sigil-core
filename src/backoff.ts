import { SigilError } from './errors.js';

/**
 * How many times a delivery is attempted in total, counting the first one.
 * Attempt 8 lands a little over two hours after attempt 1.
 */
export const MAX_ATTEMPTS = 8;

/** Delay after the first failure. Every later delay doubles from here. */
export const BASE_DELAY_MS = 1_000;

/** Ceiling on any single delay. Reached at attempt 7 with the defaults. */
export const MAX_DELAY_MS = 3_600_000;

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Delay before retry number `attempt`, in milliseconds.
 *
 * `attempt` is 1-based and counts retries, not deliveries: `nextDelayMs(1)`
 * is how long to wait after the first failure. Doubling continues until
 * `maxDelayMs`, after which every further delay is the cap.
 *
 * The result is deterministic — no jitter. A caller that needs to spread a
 * thundering herd should add its own, because a scheduler that persists the
 * next attempt time needs to be able to recompute it exactly.
 */
export function nextDelayMs(attempt: number, options: BackoffOptions = {}): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new SigilError('invalid_argument', `Attempt must be a positive integer, got ${attempt}.`);
  }
  const base = options.baseDelayMs ?? BASE_DELAY_MS;
  const max = options.maxDelayMs ?? MAX_DELAY_MS;

  // Compute in floating point and clamp, rather than shifting: attempt 40
  // would overflow a 32-bit shift and wrap to a negative delay.
  const uncapped = base * Math.pow(2, attempt - 1);
  return Math.min(uncapped, max);
}

/**
 * Every delay for a delivery that exhausts its attempts, in order.
 *
 * The array has `MAX_ATTEMPTS - 1` entries: there is no delay before the
 * first delivery, and none after the last failure.
 */
export function retrySchedule(options: BackoffOptions & { maxAttempts?: number } = {}): number[] {
  const attempts = options.maxAttempts ?? MAX_ATTEMPTS;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new SigilError('invalid_argument', `maxAttempts must be a positive integer, got ${attempts}.`);
  }
  return Array.from({ length: attempts - 1 }, (_, i) => nextDelayMs(i + 1, options));
}

/** Total wall-clock time from the first failure to the last, in milliseconds. */
export function totalRetryWindowMs(options: BackoffOptions & { maxAttempts?: number } = {}): number {
  return retrySchedule(options).reduce((sum, delay) => sum + delay, 0);
}
