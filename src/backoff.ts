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
  /**
   * Fraction of a delay that may be subtracted at random, between 0 and 1.
   *
   * `0` (the default) keeps the schedule exactly reproducible. `0.2` spreads
   * each delay over the 80–100% band, which is enough to break up a herd of
   * senders that all failed against the same outage.
   *
   * Jitter only ever *reduces* a delay, so a jittered schedule never waits
   * longer than the documented one.
   */
  jitter?: number;
  /**
   * Source of randomness for `jitter`, returning a value in [0, 1).
   *
   * Injectable so that a caller which persists "next attempt at T" can seed a
   * reproducible generator and recompute T exactly after a restart. Defaults
   * to `Math.random`.
   */
  random?: () => number;
}

/**
 * Delay before retry number `attempt`, in milliseconds.
 *
 * `attempt` is 1-based and counts retries, not deliveries: `nextDelayMs(1)`
 * is how long to wait after the first failure. Doubling continues until
 * `maxDelayMs`, after which every further delay is the cap.
 *
 * Deterministic unless `jitter` is set. With jitter, a random fraction of the
 * delay is subtracted, so the result is never longer than the unjittered one.
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
  const capped = Math.min(uncapped, max);

  const jitter = options.jitter ?? 0;
  if (jitter === 0) return capped;
  if (!(jitter > 0 && jitter <= 1)) {
    throw new SigilError('invalid_argument', `jitter must be within (0, 1], got ${jitter}.`);
  }

  const random = options.random ?? Math.random;
  // Subtract rather than centre the window: a retry that waits *longer* than
  // the published schedule would push the last attempt past the documented
  // give-up time, which callers use to size their dead-letter alerting.
  return Math.round(capped * (1 - jitter * random()));
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
