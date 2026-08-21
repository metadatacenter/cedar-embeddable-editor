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

/** The one runtime spelling of every host configuration key. */
export const CEE_CONFIG_KEY = {
  showTemplateDescription: 'showTemplateDescription',
  readOnlyMode: 'readOnlyMode',
  trustTemplateRichText: 'trustTemplateRichText',
  showDownloadMenu: 'showDownloadMenu',
  terminologyBaseUrl: 'terminologyBaseUrl',
  bridgeBaseUrl: 'bridgeBaseUrl',
  defaultLanguage: 'defaultLanguage',
  fallbackLanguage: 'fallbackLanguage',
  languageMapPathPrefix: 'languageMapPathPrefix',
} as const;

export function configFlag(config: CeeConfig, key: string, current: boolean): boolean {
  return config != null && Object.hasOwn(config, key) ? Boolean(config[key]) : current;
}

export function configText(config: CeeConfig, key: string, current: string): string {
  return config != null && Object.hasOwn(config, key) ? String(config[key]) : current;
}

/**
 * Where a CEDAR service is, or nothing.
 *
 * The two keys naming a server — `bridgeBaseUrl` and `terminologyBaseUrl` —
 * have no default, because CEE cannot know which deployment it is embedded in.
 * Null is what "the host named no server" reads as downstream, and the empty
 * string is folded into it: a host that sets the key to `""` has named no server
 * either, and prepending it would turn every endpoint into a relative URL
 * addressed at the host's own origin.
 */
export function baseUrl(config: CeeConfig, key: string): string | null {
  const value = configText(config, key, '');
  return value === '' ? null : value;
}
