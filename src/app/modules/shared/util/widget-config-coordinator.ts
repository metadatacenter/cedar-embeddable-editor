import { AUTHORITY_DESCRIPTORS, EXTERNAL_AUTHORITY_PATH } from '../models/authority/authority-descriptor.model';
import type { ExternalAuthorityLookupService } from '../service/external-authority-lookup.service';
import type { TemplateTrustService } from '../service/template-trust.service';
import type { UserPreferencesService } from '../service/user-preferences.service';
import { baseUrl, CEE_CONFIG_KEY, CeeConfig, configFlag } from './config-reader';

/** What applying the widget configuration settled, for a caller that shows more than widgets. */
export interface WidgetConfigResult {
  readOnlyMode: boolean;
  bridgeBaseUrl: string | null;
}

/**
 * The configuration the field widgets themselves read, applied to the services they
 * read it from.
 *
 * Three settings reach a widget rather than the form around it: where the external
 * authorities are, whether a template author's rich text is trusted, and whether the
 * form is being read rather than filled in. They are applied here because two things
 * now render widgets — the editor, and the `cedar-embeddable-field` element — and a
 * setting applied by only one of them is a setting that works in a form and not in a
 * field.
 *
 * Everything else a host configures describes the surroundings: the download menu, the
 * expand controls, the template description. Those stay with the editor, which is the
 * only thing that has surroundings.
 */
export class WidgetConfigCoordinator {
  constructor(
    private readonly authorities: ExternalAuthorityLookupService,
    private readonly trust: TemplateTrustService,
    private readonly preferences: UserPreferencesService,
  ) {}

  /**
   * @param currentReadOnly what read-only is now, which an omitted key leaves alone.
   */
  apply(config: CeeConfig, currentReadOnly: boolean): WidgetConfigResult {
    const bridgeBaseUrl = baseUrl(config, CEE_CONFIG_KEY.bridgeBaseUrl);

    // Every external authority's two endpoints, in one loop.
    //
    // This was fourteen near-identical blocks — read a config key, fall back to
    // a default path, prepend the base URL, hand the result to that authority's
    // own service. An eighth authority cost two more blocks, a new service, and
    // a new injected dependency. Both paths come from the descriptor, so a host
    // moves all fourteen endpoints together by moving `bridgeBaseUrl`, or none
    // of them — and the resource root they hang off is CEE's too, so what the
    // host names is the server and nothing below it.
    //
    // Nothing is registered when the host names no bridge server, which is what
    // makes an unconfigured lookup answer with no terms rather than with a
    // request to whichever deployment the default happened to name.
    if (bridgeBaseUrl !== null) {
      const authorityRoot = bridgeBaseUrl + EXTERNAL_AUTHORITY_PATH;
      for (const descriptor of AUTHORITY_DESCRIPTORS) {
        this.authorities.setEndpoints(
          descriptor.inputType,
          authorityRoot + descriptor.searchPath,
          authorityRoot + descriptor.detailsPath,
        );
      }
    }

    this.trust.setTrustTemplateRichText(
      configFlag(config, CEE_CONFIG_KEY.trustTemplateRichText, this.trust.trustTemplateRichText),
    );

    /*
     * The widgets read read-only from `UserPreferencesService`, and this is what puts
     * it there.
     *
     * It used to travel through the preferences menu: the host's flag was an input on
     * that component, whose setter wrote to the service. So a piece of host
     * configuration reached the form only by passing through a UI control — which is
     * how the control came to be able to override it, and why the menu had to stay
     * instantiated even when configured invisible, or read-only never arrived at all.
     */
    const readOnlyMode = configFlag(config, CEE_CONFIG_KEY.readOnlyMode, currentReadOnly);
    this.preferences.setReadOnlyMode(readOnlyMode);

    return { readOnlyMode, bridgeBaseUrl };
  }
}
