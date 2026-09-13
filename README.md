# @sigil/core

Webhook signing, verification and delivery-retry policy. No dependencies, no
network, no clock reads you cannot override.

This package is the single source of truth for Sigil's signature format. The
[`sigil` CLI](https://github.com/fairsplitt/sigil-cli) is a thin shell over
it, and the two must agree on every constant documented here.

## Install

```
npm install @sigil/core
```

## Sign

```ts
import { sign } from '@sigil/core';

const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
const header = sign(body, process.env.WEBHOOK_SECRET!);
// t=1767225600,v1=6b1f…

await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Sigil-Signature': header },
  body,
});
```

Sign the exact bytes you send. Never re-serialise the body between signing and
sending — two JSON encoders disagree about key order and whitespace, and the
receiver cannot reproduce a digest over bytes it never saw.

## Verify

```ts
import { verify, SigilError } from '@sigil/core';

try {
  verify(rawBody, req.headers['sigil-signature'], process.env.WEBHOOK_SECRET!);
} catch (error) {
  if (error instanceof SigilError) {
    return res.status(400).json({ error: error.code });
  }
  throw error;
}
```

`verify` returns the header's timestamp and throws `SigilError` on any
rejection. `verifyResult` returns `{ ok: false, code }` instead, for callers
that would rather branch than catch.

Read the raw request body. A framework that has already parsed and re-encoded
JSON for you has destroyed the bytes the signature covers.

## Documentation

- [Signature format](docs/signature-format.md) — the wire format, byte for byte
- [Verification](docs/verification.md) — the tolerance window and error codes
- [Retry policy](docs/retry-policy.md) — the delivery schedule
- [Key rotation](docs/key-rotation.md) — changing a secret without dropping events

## License

MIT
