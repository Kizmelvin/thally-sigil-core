# Key rotation

Changing a webhook secret without dropping events takes three deploys. The
signature format supports it directly: a header may carry more than one `v1`
element, and a verifier may hold more than one secret.

## 1. Teach receivers the new secret

Verify against both. Order does not matter — every secret is tried.

```ts
verify(body, header, [process.env.SECRET_OLD!, process.env.SECRET_NEW!]);
```

At this point nothing signs with the new secret yet, so every request still
matches the old one.

## 2. Sign with both

```ts
const header = sign(body, [process.env.SECRET_OLD!, process.env.SECRET_NEW!]);
// t=1767225600,v1=<old>,v1=<new>
```

One `v1` element is emitted per secret, in the order given. A receiver that has
only the old secret matches the first; one that has both matches either. No
request is rejected during the overlap.

Wait out your slowest consumer before moving on. Anything still holding only
the old secret keeps working, which is the point of the overlap.

## 3. Drop the old secret

Sign with the new secret alone, then remove the old one from receivers.

```ts
const header = sign(body, process.env.SECRET_NEW!);
```

## Limits

At most **8** signatures fit in one header (`MAX_SIGNATURES_PER_HEADER`); a
ninth is rejected with `header_too_many_signatures`. Rotating two secrets at a
time never comes close, and the ceiling stops a caller from making the receiver
compute an unbounded number of HMACs.

An empty string is not a valid secret in either direction — `sign` and `verify`
both reject it with `secret_empty` rather than treating it as "no secret".
