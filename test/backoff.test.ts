import { describe, expect, it } from 'vitest';
import {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  nextDelayMs,
  retrySchedule,
  totalRetryWindowMs,
} from '../src/backoff.js';
import { SigilError } from '../src/errors.js';

describe('nextDelayMs', () => {
  it('waits the base delay after the first failure', () => {
    expect(nextDelayMs(1)).toBe(BASE_DELAY_MS);
  });

  it('doubles each attempt', () => {
    expect([1, 2, 3, 4].map((a) => nextDelayMs(a))).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('clamps at the ceiling instead of overflowing', () => {
    expect(nextDelayMs(40)).toBe(MAX_DELAY_MS);
    expect(nextDelayMs(1000)).toBe(MAX_DELAY_MS);
  });

  it('rejects a non-positive or fractional attempt', () => {
    for (const bad of [0, -1, 1.5]) {
      expect(() => nextDelayMs(bad)).toThrow(SigilError);
    }
  });

  it('honours custom base and ceiling', () => {
    expect(nextDelayMs(3, { baseDelayMs: 100, maxDelayMs: 250 })).toBe(250);
  });
});

describe('retrySchedule', () => {
  it('has one fewer entry than there are attempts', () => {
    expect(retrySchedule()).toHaveLength(MAX_ATTEMPTS - 1);
  });

  it('is the documented default schedule', () => {
    expect(retrySchedule()).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000]);
  });

  it('sums to the documented total window', () => {
    expect(totalRetryWindowMs()).toBe(127_000);
  });

  it('returns nothing when only one attempt is allowed', () => {
    expect(retrySchedule({ maxAttempts: 1 })).toEqual([]);
  });
});
