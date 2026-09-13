import { MAX_SIGNATURES_PER_HEADER, SIGNATURE_VERSION } from './constants.js';
import { SigilError } from './errors.js';

/** A parsed `Sigil-Signature` header. */
export interface ParsedHeader {
  /** Unix time in seconds, as claimed by the sender. */
  timestamp: number;
  /** Lower-case hex digests, in the order they appeared. */
  signatures: string[];
}

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Parse a `Sigil-Signature` header.
 *
 * The format is a comma-separated list of `key=value` pairs:
 *
 *     t=1767225600,v1=<64 hex chars>
 *
 * Exactly one `t` is required. One or more `v1` entries are required — more
 * than one only during secret rotation. Unknown keys are ignored rather than
 * rejected, so that a future scheme version can be introduced alongside `v1`
 * without old verifiers refusing the header outright.
 */
export function parseHeader(header: string): ParsedHeader {
  if (typeof header !== 'string' || header.trim() === '') {
    throw new SigilError('header_malformed', 'Signature header is empty.');
  }

  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const rawPart of header.split(',')) {
    const part = rawPart.trim();
    if (part === '') {
      throw new SigilError('header_malformed', `Signature header has an empty element: "${header}".`);
    }

    const eq = part.indexOf('=');
    if (eq <= 0) {
      throw new SigilError('header_malformed', `Signature header element "${part}" is not key=value.`);
    }

    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === 't') {
      if (timestamp !== undefined) {
        throw new SigilError('header_malformed', 'Signature header carries more than one timestamp.');
      }
      timestamp = parseTimestamp(value);
    } else if (key === SIGNATURE_VERSION) {
      if (!HEX_64.test(value)) {
        throw new SigilError(
          'header_malformed',
          `Signature "${value}" is not 64 lower-case hex characters.`,
        );
      }
      signatures.push(value);
    }
    // Any other key belongs to a scheme this build does not know. Skip it.
  }

  if (timestamp === undefined) {
    throw new SigilError('header_malformed', 'Signature header has no `t` element.');
  }
  if (signatures.length === 0) {
    throw new SigilError(
      'header_no_signatures',
      `Signature header carries no \`${SIGNATURE_VERSION}\` element.`,
    );
  }
  if (signatures.length > MAX_SIGNATURES_PER_HEADER) {
    throw new SigilError(
      'header_too_many_signatures',
      `Signature header carries ${signatures.length} signatures; the limit is ${MAX_SIGNATURES_PER_HEADER}.`,
    );
  }

  return { timestamp, signatures };
}

/**
 * Timestamps are whole, non-negative seconds. Leading zeros, `+`, decimals
 * and exponent forms are all rejected — `Number()` would happily accept them
 * and two verifiers could then disagree about what the header said.
 */
function parseTimestamp(value: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new SigilError('header_timestamp_invalid', `Timestamp "${value}" is not a whole number of seconds.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new SigilError('header_timestamp_invalid', `Timestamp "${value}" is out of range.`);
  }
  return parsed;
}

/** Render a parsed header back to wire format. */
export function formatHeader(parsed: ParsedHeader): string {
  return [`t=${parsed.timestamp}`, ...parsed.signatures.map((s) => `${SIGNATURE_VERSION}=${s}`)].join(',');
}
