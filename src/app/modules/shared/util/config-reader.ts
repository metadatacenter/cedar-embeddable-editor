/**
 * Reading host-supplied configuration without lying about what came back.
 *
 * CEE's config is JSON handed in by whatever page embeds it, so its values are
 * `unknown` and nothing can promise otherwise. Both the editor and its wrapper used
 * to read it with `Object.hasOwn(...)` and assign straight out of an untyped bag,
 * which meant a host sending `"true"` left a *string* in a field declared `boolean`.
 * Every use is a truthiness test, so nothing visibly broke — the declared type was
 * simply false.
 *
 * `Boolean()` and `String()` preserve exactly what those call sites already did with
 * the value, and make the declared type true.
 *
 * Neither validates. Rejecting a wrong-typed key belongs with the typed host
 * contract on the roadmap; doing it here would change behaviour, and this does not.
 */
export type CeeConfig = Record<string, unknown>;

export function configFlag(config: CeeConfig, key: string, current: boolean): boolean {
  return config != null && Object.hasOwn(config, key) ? Boolean(config[key]) : current;
}

export function configText(config: CeeConfig, key: string, current: string): string {
  return config != null && Object.hasOwn(config, key) ? String(config[key]) : current;
}

/** Present and set to something truthy — the shape the read-only and sample-load gates want. */
export function configHas(config: CeeConfig, key: string): boolean {
  return config != null && Object.hasOwn(config, key);
}
