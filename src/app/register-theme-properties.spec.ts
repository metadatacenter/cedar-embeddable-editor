import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CEE_THEME_PROPERTIES, registerCeeThemeProperties } from './register-theme-properties';

describe('the published theme properties', () => {
  /**
   * The registered fallback and the published default are the same number.
   *
   * They are written in two files, and they have to be: registration runs before
   * any stylesheet is parsed, so there is nothing for it to read the default from.
   * That makes them a pair that can drift, and the drift would be close to
   * invisible — a heading would look right until an embedder set the property to
   * something invalid, at which point it would fall back to a value nothing
   * documents. This is the test that makes the duplication safe rather than a
   * comment asking the next person to remember.
   */
  it('fall back to the values `styles-own.scss` publishes on :host', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../styles-own.scss'), 'utf8');

    for (const { name, initialValue } of CEE_THEME_PROPERTIES) {
      const declaration = new RegExp(`${name}:\\s*([^;]+);`).exec(stylesheet);
      expect(declaration, `${name} is not published on :host in styles-own.scss`).not.toBeNull();
      expect(declaration![1].trim(), `${name} registers a different fallback than it publishes`).toBe(initialValue);
    }
  });

  /**
   * Every typed property is one an embedder sets to a number.
   *
   * That is the whole reason the set is this small, and stating it as a test keeps
   * a colour from being added here later on the assumption that typing everything
   * is tidier. A colour that fails to parse falls back visibly; a length that does
   * cannot be told from a deliberate choice.
   */
  it('are lengths and numbers, not colours', () => {
    for (const { name, syntax } of CEE_THEME_PROPERTIES) {
      expect(['<length>', '<number>'], `${name} has an unexpected syntax`).toContain(syntax);
    }
  });
});

describe('registering them', () => {
  const fakeCss = (registerProperty: (definition: unknown) => void) => ({ registerProperty }) as unknown as typeof CSS;

  it('registers each property as inheriting, so it reaches into the shadow root', () => {
    const seen: Array<Record<string, unknown>> = [];
    const registered = registerCeeThemeProperties(fakeCss((d) => seen.push(d as Record<string, unknown>)));

    expect(registered).toEqual(CEE_THEME_PROPERTIES.map((p) => p.name));
    expect(seen.map((d) => d['inherits'])).toEqual([true, true, true]);
    expect(seen.map((d) => d['name'])).toEqual(CEE_THEME_PROPERTIES.map((p) => p.name));
  });

  /**
   * A duplicate registration is the ordinary case, not the exceptional one.
   *
   * Two copies of the bundle on a page, or a host that registered the same name
   * first, both land here — and both mean the property is already typed, which is
   * the objective. `CSS.registerProperty` signals it by throwing, so swallowing
   * that throw is the correct handling rather than a suppressed error.
   */
  it('survives a name that is already registered', () => {
    const thrower = fakeCss(() => {
      throw new DOMException('already registered', 'InvalidModificationError');
    });

    expect(() => registerCeeThemeProperties(thrower)).not.toThrow();
    expect(registerCeeThemeProperties(thrower)).toEqual([]);
  });

  it('registers what it can when only one name is taken', () => {
    let call = 0;
    const partial = fakeCss(() => {
      if (call++ === 1) {
        throw new DOMException('already registered', 'InvalidModificationError');
      }
    });

    expect(registerCeeThemeProperties(partial)).toEqual(['--cee-element-heading-size', '--cee-element-content-gap']);
  });

  /** A browser without the API is a supported browser, not a failure. */
  it('does nothing where the API is absent', () => {
    expect(registerCeeThemeProperties(undefined)).toEqual([]);
    expect(registerCeeThemeProperties({} as unknown as typeof CSS)).toEqual([]);
  });

  it('reads the global CSS object when given no target', () => {
    const spy = vi.fn();
    vi.stubGlobal('CSS', { registerProperty: spy });
    try {
      // The default argument is evaluated against the global, so this covers the
      // call `main.ts` actually makes.
      expect(registerCeeThemeProperties(globalThis.CSS)).toEqual(CEE_THEME_PROPERTIES.map((p) => p.name));
      expect(spy).toHaveBeenCalledTimes(CEE_THEME_PROPERTIES.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
