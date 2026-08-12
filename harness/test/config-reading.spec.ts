/**
 * How a host's configuration values reach CEE's fields.
 *
 * `config-reader.ts` is three lines of logic guarding every setting CEE has, and
 * it had no tests at all — 10 of `shared/util`'s 28 uncovered branches sat in
 * this one file, which is what took that floor to within three branches of
 * failing. It is plain TypeScript touching no framework and no DOM, so it
 * belongs here rather than beside the source.
 *
 * Two behaviours are worth pinning rather than merely covering. Absence is not
 * the same as falsehood, which is why these read with `Object.hasOwn` instead of
 * a truthiness test — a host that sends `showFooter: false` means it. And the
 * fallback is the *current* value rather than a default, which is the mechanism
 * behind the patch-versus-replace behaviour the published host contract warns
 * about: omitting a key does not reset it.
 *
 * The coercion cases are here because the file's own comment says these
 * functions preserve what the call sites already did with an untyped value, and
 * `Boolean('false')` is where that promise gets uncomfortable.
 */
import { describe, expect, it } from 'vitest';
import { configFlag, configText } from '@cee/util/config-reader';

describe('a key the host did not send', () => {
  it('leaves a flag at the value CEE already had', () => {
    expect(configFlag({}, 'showFooter', true)).toBe(true);
    expect(configFlag({ somethingElse: true }, 'showFooter', false)).toBe(false);
  });

  it('leaves text at the value CEE already had', () => {
    expect(configText({}, 'defaultLanguage', 'en')).toBe('en');
  });

  /**
   * Not a defensive flourish. `config` arrives from a host, and a host binding it
   * through a framework template can deliver null before it has anything to send.
   */
  it('is what a null or undefined configuration looks like', () => {
    expect(configFlag(null as unknown as Record<string, unknown>, 'showFooter', true)).toBe(true);
    expect(configFlag(undefined as unknown as Record<string, unknown>, 'showFooter', false)).toBe(false);
    expect(configText(null as unknown as Record<string, unknown>, 'defaultLanguage', 'en')).toBe('en');
  });
});

describe('a key the host did send', () => {
  it('wins over the current value', () => {
    expect(configFlag({ showFooter: true }, 'showFooter', false)).toBe(true);
    expect(configText({ defaultLanguage: 'hu' }, 'defaultLanguage', 'en')).toBe('hu');
  });

  /**
   * The reason this reads with `Object.hasOwn` rather than truthiness. Under a
   * truthiness test `false` would be indistinguishable from absent, and a host
   * turning a panel off would silently get whatever CEE already had.
   */
  it('wins even when the value is false', () => {
    expect(configFlag({ showFooter: false }, 'showFooter', true)).toBe(false);
  });

  it('wins even when the value is an empty string', () => {
    expect(configText({ defaultLanguage: '' }, 'defaultLanguage', 'en')).toBe('');
  });

  /**
   * `{ showFooter: undefined }` is a key the host set, so it is read rather than
   * skipped — and it coerces to false. A host meaning "leave this alone" has to
   * omit the key, not set it to undefined.
   */
  it('counts an explicit undefined as sent, not as absent', () => {
    expect(configFlag({ showFooter: undefined }, 'showFooter', true)).toBe(false);
  });
});

describe('a value of the wrong type', () => {
  it('is coerced rather than rejected', () => {
    expect(configFlag({ showFooter: 'true' }, 'showFooter', false)).toBe(true);
    expect(configFlag({ showFooter: 1 }, 'showFooter', false)).toBe(true);
    expect(configText({ defaultLanguage: 42 }, 'defaultLanguage', 'en')).toBe('42');
  });

  /**
   * The sharp edge, recorded because it is surprising rather than because it is
   * right: a host sending the *string* `'false'` enables the setting, since a
   * non-empty string is truthy. Reading it is not what catches this —
   * `validateCeeConfig` reports the key as expecting a boolean, which is the
   * boundary that exists for exactly this.
   */
  it('turns the string "false" into true', () => {
    expect(configFlag({ showFooter: 'false' }, 'showFooter', false)).toBe(true);
  });

  it('turns a null into the text "null"', () => {
    expect(configText({ defaultLanguage: null }, 'defaultLanguage', 'en')).toBe('null');
  });
});
