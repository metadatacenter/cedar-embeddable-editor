/**
 * The value a translation's `label` parameter takes so that the label's place in the translated text
 * can be found. No translation contains it.
 */
export const LABEL_SLOT = '\u0000';

/** What a translation that joins CEE's words to a label puts before the label and after it. */
export interface AroundLabel {
  readonly before: string;
  readonly after: string;
  /** False where the translation leaves the label out, so that all of it is CEE's words. */
  readonly labelled: boolean;
}

/**
 * Split a translation asked for with `LABEL_SLOT` as its label into CEE's words before the label and
 * after it.
 *
 * The slot is found wherever the language puts the label, so the split holds for any word order. A
 * label that a translation repeats is shown once, at its first place, and the later slots are dropped.
 */
export function aroundLabel(translated: string): AroundLabel {
  const at = translated.indexOf(LABEL_SLOT);
  if (at < 0) {
    return { before: translated, after: '', labelled: false };
  }
  return {
    before: translated.slice(0, at),
    after: translated.slice(at + LABEL_SLOT.length).replaceAll(LABEL_SLOT, ''),
    labelled: true,
  };
}
