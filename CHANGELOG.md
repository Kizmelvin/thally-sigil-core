# Changelog

## 0.1.0

Initial release.

- `sign`, `computeSignature` and `signingPayload` for producing a
  `Sigil-Signature` header.
- `verify` and `verifyResult` for checking one, with a 300-second default
  tolerance window and constant-time digest comparison.
- `parseHeader` and `formatHeader` for the `t=…,v1=…` wire format, including
  multi-signature headers for key rotation.
- `nextDelayMs`, `retrySchedule` and `totalRetryWindowMs` for the delivery
  retry policy.
