# Verification

```ts
import { verify } from '@sigil/core';

const timestamp = verify(rawBody, header, secret);
```

`verify` returns the header's timestamp on success and throws `SigilError`
otherwise. `verifyResult` returns a discriminated union instead:

```ts
const result = verifyResult(rawBody, header, secret);
if (!result.ok) console.warn(result.code);
```

## Order of checks

1. The secrets are non-empty.
2. The header parses.
3. The timestamp is inside the tolerance window.
4. Some signature matches some secret.

The timestamp is checked **before** any HMAC is computed. A flood of stale
requests therefore costs one integer comparison each rather than one hash each.
The observable consequence: a request that is both expired and wrongly signed
reports `timestamp_out_of_tolerance`, never `signature_mismatch`.

## The tolerance window

`DEFAULT_TOLERANCE_SECONDS` is **300** — five minutes. A timestamp is accepted
when `abs(now - t) <= tolerance`, so the window is symmetric: a sender whose
clock runs fast is treated exactly like one that runs slow.

Exactly 300 seconds of drift is accepted; 301 is not.

```ts
verify(body, header, secret, { toleranceSeconds: 60 });  // stricter
verify(body, header, secret, { toleranceSeconds: 0 });   // no window at all
verify(body, header, secret, { now: 1767225600 });       // fixed clock, for tests
```

`toleranceSeconds: 0` disables the check completely rather than demanding an
exact match. Only use it where replay is prevented some other way — an
idempotency table, say.

## Constant-time comparison

Digests are compared with `crypto.timingSafeEqual`. A length mismatch would
make that throw, and the throw would itself be a signal, so unequal lengths are
turned into a constant-time `false`.

Every secret is checked against every signature even after a match is found, so
the work done does not reveal which pair matched.

## Error codes

Every rejection carries a stable `code`. Branch on it; the human-readable
`message` may change between releases.

| Code                         | Meaning                                          |
| ---------------------------- | ------------------------------------------------ |
| `header_malformed`           | Not `key=value` pairs, missing `t`, or a bad digest |
| `header_timestamp_invalid`   | `t` is not whole, non-negative seconds            |
| `header_no_signatures`       | No `v1` element present                           |
| `header_too_many_signatures` | More than 8 `v1` elements                         |
| `signature_mismatch`         | No signature matched any secret                   |
| `timestamp_out_of_tolerance` | Outside the window                                |
| `secret_empty`               | A supplied secret was the empty string            |
| `invalid_argument`           | A caller passed a value the API cannot use        |

`SIGIL_ERROR_CODES` exports this set in order.

> **Cross-repo contract.** The `sigil` CLI maps each of these codes to its own
> process exit code, one for one. Adding, removing or renaming a code here is a
> breaking change for that mapping — see
> [`sigil-cli` exit codes](https://github.com/fairsplitt/sigil-cli/blob/main/docs/exit-codes.md).
