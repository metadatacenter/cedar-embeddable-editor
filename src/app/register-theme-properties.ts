/**
 * Give CEE's published custom properties a type, so an embedder's mistake falls
 * back to the documented default instead of to something arbitrary.
 *
 * Unregistered, a custom property is an untyped token: the browser accepts any
 * value and only discovers the problem where it is used. `--cee-element-heading-size:
 * banana` therefore made `font-size: var(--cee-element-heading-size)` invalid at
 * computed-value time, and `font-size` then *inherited* — so a typo silently
 * rendered a heading at the 14px body size rather than at the 18px this file
 * declares. Which is the worst of the available failures, because 14px looks like
 * a decision.
 *
 * Registration fixes exactly that, and only that. A registered property parses its
 * value against `syntax`, and a value that does not match is discarded in favour of
 * `initialValue`. It says nothing about range: `-20px` and `100px` are both
 * perfectly good `<length>`s and both pass. The clamps at the consumption sites in
 * `cedar-component-renderer.component.scss` are what bound those, so the two
 * mechanisms are complementary rather than alternatives — one answers the wrong
 * kind of value, the other the wrong amount of it.
 *
 * **Why JS rather than `@property`.** CEE's styles live in a shadow root, and an
 * `@property` rule inside a shadow-root stylesheet is ignored — it registers
 * nothing, silently. Tested: with the rule in the shadow root, an unset property
 * still resolved to the inherited 14px rather than to its declared initial value.
 * Registration is document-scoped, so it has to happen from somewhere that can
 * reach the document, and `CSS.registerProperty` from the bundle's entry point is
 * the supported way to do that. A document-level `@property` rule works too, but
 * CEE cannot inject one into a host page it does not own without also owning where
 * in the cascade it lands.
 *
 * Registering document-wide from inside a component is a real side effect on the
 * host page, and it is bounded deliberately: only names in CEE's own `--cee-`
 * namespace, only ever `initialValue`s this repository already publishes on
 * `:host`, and never a name a host page would plausibly have registered for its
 * own purposes.
 */

/** One published property, and what a bad value should fall back to. */
interface ThemeProperty {
  name: string;
  syntax: string;
  initialValue: string;
}

/**
 * The typed properties, and the reason the set is this small.
 *
 * These are the three an embedder can set to a *number*, which is what makes a
 * wrong value hard to notice. The colour properties are deliberately absent: an
 * invalid colour falls back to the same inherited value, but the failure is
 * visible rather than silent, and typing a colour is not open to the confusion
 * between `18` and `18px` that a length invites.
 *
 * The `initialValue`s must agree with `styles-own.scss`, which is where the
 * defaults are published. They are stated twice because registration happens
 * before any stylesheet is parsed, so there is nothing to read them from — and a
 * test holds the two in step rather than a comment asking someone to.
 */
export const CEE_THEME_PROPERTIES: readonly ThemeProperty[] = [
  { name: '--cee-element-heading-size', syntax: '<length>', initialValue: '18px' },
  { name: '--cee-element-heading-weight', syntax: '<number>', initialValue: '600' },
  { name: '--cee-element-content-gap', syntax: '<length>', initialValue: '12px' },
];

/**
 * Register them, tolerating every way this can legitimately already be done.
 *
 * Idempotent because it has to be. Two copies of the bundle on one page, a host
 * page that registered the same name first, or a browser without the API at all
 * are all ordinary situations, and none of them is worth an error a host page
 * would see. `CSS.registerProperty` throws `InvalidModificationError` on a
 * duplicate name, which is the common case and is precisely the case where the
 * work is already done.
 *
 * @returns the names newly registered, which is what a test can assert on.
 */
export function registerCeeThemeProperties(
  target: typeof CSS | undefined = typeof CSS === 'undefined' ? undefined : CSS,
): string[] {
  if (!target || typeof target.registerProperty !== 'function') {
    return [];
  }

  const registered: string[] = [];
  for (const property of CEE_THEME_PROPERTIES) {
    try {
      target.registerProperty({ ...property, inherits: true });
      registered.push(property.name);
    } catch {
      // Already registered, by another copy of this bundle or by the host page.
      // Either way the property is typed, which is the whole objective.
    }
  }
  return registered;
}
