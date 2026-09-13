/**
 * Every rejection is one of these codes.
 *
 * The set is deliberately closed and stable: `@sigil/cli` maps each code to
 * its own process exit code, so adding a member here is a breaking change
 * for that mapping and must be reflected in the CLI's exit-code table.
 */
export type SigilErrorCode =
  | 'header_malformed'
  | 'header_timestamp_invalid'
  | 'header_no_signatures'
  | 'header_too_many_signatures'
  | 'signature_mismatch'
  | 'timestamp_out_of_tolerance'
  | 'secret_empty'
  | 'invalid_argument'
  | 'payload_not_json';

/** Every code, in the order the CLI's exit-code table lists them. */
export const SIGIL_ERROR_CODES: readonly SigilErrorCode[] = [
  'header_malformed',
  'header_timestamp_invalid',
  'header_no_signatures',
  'header_too_many_signatures',
  'signature_mismatch',
  'timestamp_out_of_tolerance',
  'secret_empty',
  'invalid_argument',
  'payload_not_json',
] as const;

/**
 * A verification failure.
 *
 * The message is for humans and may change between releases; branch on
 * `code`, never on the message text.
 */
export class SigilError extends Error {
  readonly code: SigilErrorCode;

  constructor(code: SigilErrorCode, message: string) {
    super(message);
    this.name = 'SigilError';
    this.code = code;
  }
}
