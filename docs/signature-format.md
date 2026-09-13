# Signature format

A signed request carries one header. Its name is `Sigil-Signature`, exported as
`HEADER_NAME`.

```
Sigil-Signature: t=1767225600,v1=6b1f…0a3c
```

## Grammar

The value is a comma-separated list of `key=value` elements. Whitespace around
an element is ignored.

| Key  | Required | Repeats | Value                                     |
| ---- | -------- | ------- | ----------------------------------------- |
| `t`  | yes      | no      | Unix time in whole seconds                |
| `v1` | yes      | yes     | 64 lower-case hex characters (HMAC-SHA256) |

`t` must be a whole, non-negative number of seconds. Leading zeros, a leading
`+`, decimals and exponent forms are all rejected — `Number()` accepts them,
and two verifiers that disagreed about what `t=1.5e3` meant would disagree
about whether a request was fresh.

A `v1` value must be exactly 64 lower-case hex characters. Upper-case is
rejected rather than folded, so that a digest has exactly one valid encoding.

Elements with any other key are **ignored, not rejected**. That is what allows
a future `v2` to ship alongside `v1`: an old verifier skips what it does not
recognise and keeps checking the `v1` it does.

At most `MAX_SIGNATURES_PER_HEADER` — **8** — `v1` elements may appear. More
than one is only meaningful during [key rotation](key-rotation.md). The ceiling
exists because each element costs the verifier an HMAC, and an unbounded list
would let a caller choose how much work to charge the receiver.

## Signed bytes

The digest covers the timestamp, a single ASCII dot, then the raw body:

```
HMAC-SHA256(secret, "<t>." + body)
```

`signingPayload(timestamp, body)` returns those bytes if you want to inspect
them. A string body is encoded as UTF-8; a `Uint8Array` is used as-is.

The timestamp is inside the signed material on purpose. If it travelled beside
an unbound signature, anyone could replay a captured body under a fresh
timestamp and it would still verify.

## Stability

`SIGNATURE_VERSION` is `v1`. The prefix, the dot separator, the digest
algorithm and the hex encoding are all part of the wire contract: changing any
of them breaks every deployed receiver and requires a new version prefix rather
than an edit to this one.
