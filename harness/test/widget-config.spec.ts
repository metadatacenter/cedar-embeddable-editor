/**
 * The configuration the widgets themselves read.
 *
 * Three settings land on services rather than on a component — the authority
 * endpoints, whether template rich text is trusted, and read-only mode — and two
 * things now apply them: the editor, and the `cedar-embeddable-field` element. They are
 * applied through one coordinator so a setting cannot work in a form and not in a lone
 * field, and that is what this checks: what each key does, and what an omitted key
 * leaves alone.
 *
 * The services are stood in for. The coordinator calls three methods between them and
 * takes them as constructor parameters, so what it does is observable without Angular
 * and there is nothing here a real `HttpClient` would make truer.
 */
import { describe, expect, it } from 'vitest';
import { AUTHORITY_DESCRIPTORS, EXTERNAL_AUTHORITY_PATH } from '@cee/models/authority/authority-descriptor.model';
import type { ExternalAuthorityLookupService } from '@cee/service/external-authority-lookup.service';
import type { TemplateTrustService } from '@cee/service/template-trust.service';
import type { UserPreferencesService } from '@cee/service/user-preferences.service';
import { WidgetConfigCoordinator } from '@cee/util/widget-config-coordinator';

interface Registered {
  inputType: string;
  search: string;
  details: string;
}

const stand = () => {
  const endpoints: Registered[] = [];
  let trusted = false;
  const readOnly: boolean[] = [];

  const authorities = {
    setEndpoints: (inputType: string, search: string, details: string) =>
      endpoints.push({ inputType, search, details }),
  } as unknown as ExternalAuthorityLookupService;
  const trust = {
    get trustTemplateRichText(): boolean {
      return trusted;
    },
    setTrustTemplateRichText: (value: boolean) => {
      trusted = value;
    },
  } as unknown as TemplateTrustService;
  const preferences = {
    setReadOnlyMode: (value: boolean) => readOnly.push(value),
  } as unknown as UserPreferencesService;

  return {
    endpoints,
    readOnly,
    trusted: () => trusted,
    coordinator: new WidgetConfigCoordinator(authorities, trust, preferences),
  };
};

describe('the authority endpoints', () => {
  it('are all registered under the one base a host names', () => {
    const stood = stand();

    const result = stood.coordinator.apply({ bridgeBaseUrl: 'https://bridge.example.org/' }, false);

    expect(result.bridgeBaseUrl).toBe('https://bridge.example.org/');
    expect(stood.endpoints).toHaveLength(AUTHORITY_DESCRIPTORS.length);
    const first = AUTHORITY_DESCRIPTORS[0];
    expect(stood.endpoints[0]).toEqual({
      inputType: first.inputType,
      search: `https://bridge.example.org/${EXTERNAL_AUTHORITY_PATH}${first.searchPath}`,
      details: `https://bridge.example.org/${EXTERNAL_AUTHORITY_PATH}${first.detailsPath}`,
    });
  });

  /**
   * A host that names no bridge server gets no lookups, rather than lookups against
   * whichever deployment a default would have named.
   */
  it('are left unregistered when no bridge server is named', () => {
    const stood = stand();

    const result = stood.coordinator.apply({}, false);

    expect(result.bridgeBaseUrl).toBeNull();
    expect(stood.endpoints).toEqual([]);
  });

  it('are left unregistered when the key is empty, which names no server either', () => {
    const stood = stand();

    expect(stood.coordinator.apply({ bridgeBaseUrl: '' }, false).bridgeBaseUrl).toBeNull();
    expect(stood.endpoints).toEqual([]);
  });
});

describe('read-only mode', () => {
  it('is what the host asked for', () => {
    const stood = stand();

    expect(stood.coordinator.apply({ readOnlyMode: true }, false).readOnlyMode).toBe(true);
    expect(stood.readOnly).toEqual([true]);
  });

  /** An omitted key leaves the current mode alone rather than resetting it. */
  it('keeps what it was when the key is omitted', () => {
    const stood = stand();

    expect(stood.coordinator.apply({}, true).readOnlyMode).toBe(true);
    expect(stood.readOnly).toEqual([true]);
  });

  it('is off when the host says so', () => {
    const stood = stand();

    expect(stood.coordinator.apply({ readOnlyMode: false }, true).readOnlyMode).toBe(false);
    expect(stood.readOnly).toEqual([false]);
  });
});

describe('trusting a template author', () => {
  it('is off unless the host says otherwise', () => {
    const stood = stand();

    stood.coordinator.apply({}, false);

    expect(stood.trusted()).toBe(false);
  });

  it('is on when the host says so', () => {
    const stood = stand();

    stood.coordinator.apply({ trustTemplateRichText: true }, false);

    expect(stood.trusted()).toBe(true);
  });
});
