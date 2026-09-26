/**
 * Text a user reads, identified by its translation key rather than written in one language.
 *
 * A validator knows what is wrong with a value, and the language bundle knows how to say it. Handing
 * the template a key and its parameters keeps the two apart: the template renders it through the
 * `translate` pipe, so the sentence follows the language CEE was configured with.
 */
export interface Translatable {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}
