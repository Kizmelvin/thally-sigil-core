# Retry policy

Sigil ships the delivery schedule as data so that a sender, a dashboard and the
CLI all quote the same numbers.

```ts
import { nextDelayMs, retrySchedule, totalRetryWindowMs } from '@sigil/core';
```

## The default schedule

`MAX_ATTEMPTS` is **8**. That counts the first delivery, so a failing endpoint
is retried **7** times.

| Retry | Delay before it | Elapsed since first failure |
| ----- | --------------- | --------------------------- |
| 1     | 1s              | 1s                          |
| 2     | 2s              | 3s                          |
| 3     | 4s              | 7s                          |
| 4     | 8s              | 15s                         |
| 5     | 16s             | 31s                         |
| 6     | 32s             | 1m 3s                       |
| 7     | 64s             | 2m 7s                       |

`retrySchedule()` returns exactly those delays in milliseconds:
`[1000, 2000, 4000, 8000, 16000, 32000, 64000]` — one fewer entry than
`MAX_ATTEMPTS`, because nothing is waited before the first delivery or after
the last failure.

`totalRetryWindowMs()` is therefore **127000** — two minutes and seven seconds
from first failure to final give-up.

## The curve

`nextDelayMs(attempt)` is `BASE_DELAY_MS * 2^(attempt - 1)`, clamped to
`MAX_DELAY_MS`. `attempt` is 1-based and counts retries: `nextDelayMs(1)` is
the wait after the *first* failure.

- `BASE_DELAY_MS` is **1000**
- `MAX_DELAY_MS` is **3600000** (one hour)

With the defaults the ceiling is never reached — attempt 7 waits 64s, well
under an hour. It only bites when `maxAttempts` is raised or the base is:

```ts
nextDelayMs(40);                                  // 3600000, clamped
nextDelayMs(3, { baseDelayMs: 100, maxDelayMs: 250 }); // 250
```

The clamp is a `Math.min` over a floating-point power, not a bit shift. A shift
would overflow past attempt 31 and hand back a negative delay.

## No jitter

The schedule is deterministic. Two callers that fail at the same instant will
retry at the same instant.

That is a deliberate trade. A scheduler that persists "next attempt at T" has
to be able to recompute T exactly after a restart, and it cannot do that if the
library rolled a die. Spread the herd at the layer that owns the queue:

```ts
const delay = nextDelayMs(attempt) + Math.floor(Math.random() * 1000);
```
