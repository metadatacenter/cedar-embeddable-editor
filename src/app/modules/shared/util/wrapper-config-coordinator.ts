import { TranslateService } from '@ngx-translate/core';
import { CEE_CONFIG_KEY, CeeConfig, baseUrl, configFlag, configText } from './config-reader';
import { checkCeeConfig } from './config-validation';
import { ControlledFieldDataService, INTEGRATED_SEARCH_PATH } from '../service/controlled-field-data.service';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';
import { MessageHandlerService } from '../service/message-handler.service';
import { HandlerContext } from './handler-context';
import { TranslationMap } from './fallback-translate-loader';

/** Host configuration and language initialization, kept out of artifact intake. */
export class WrapperConfigCoordinator {
  private configured = false;
  private defaultLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;
  private fallbackLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;
  private _config: CeeConfig | null = null;

  constructor(
    private readonly controlledFields: ControlledFieldDataService,
    private readonly messages: MessageHandlerService,
    private readonly translate: TranslateService,
    private readonly globals: GlobalSettingsContextService,
  ) {}

  get config(): CeeConfig | null {
    return this._config;
  }

  get hasConfiguration(): boolean {
    return this.configured;
  }

  accept(value: CeeConfig): boolean {
    if (this.configured) {
      this.messages.error(
        'CEDAR Embeddable Editor: "config" ignored, because the editor is already configured. Configuration ' +
          'takes one assignment; create a new editor element to configure it differently.',
      );
      return false;
    }
    this.messages.trace('CEDAR Embeddable Editor config set to:' + JSON.stringify(value));
    const { problems, usable } = checkCeeConfig(value);
    problems.forEach((problem) => this.messages.error(problem));
    if (usable === null) {
      return false;
    }
    this._config = usable;
    this.configured = true;
    return true;
  }

  apply(handlerContext: HandlerContext): void {
    const previousPathPrefix = this.globals.languageMapPathPrefix;
    const languagesLoadedBefore = [...this.translate.getLangs()];
    const config = this._config ?? {};

    const terminologyBaseUrl = baseUrl(config, CEE_CONFIG_KEY.terminologyBaseUrl);
    if (terminologyBaseUrl !== null) {
      this.controlledFields.setIntegratedSearchUrl(terminologyBaseUrl + INTEGRATED_SEARCH_PATH);
    }
    if (Object.hasOwn(config, CEE_CONFIG_KEY.languageMapPathPrefix)) {
      this.globals.languageMapPathPrefix = configText(config, CEE_CONFIG_KEY.languageMapPathPrefix, '');
    }
    if (Object.hasOwn(config, CEE_CONFIG_KEY.fallbackLanguage)) {
      this.fallbackLanguage = configText(config, CEE_CONFIG_KEY.fallbackLanguage, this.fallbackLanguage);
    } else {
      this.messages.traceGroup(
        'language',
        '"fallbackLanguage" not set, using default: "' + this.fallbackLanguage + '"',
      );
    }
    if (Object.hasOwn(config, CEE_CONFIG_KEY.defaultLanguage)) {
      this.defaultLanguage = configText(config, CEE_CONFIG_KEY.defaultLanguage, this.defaultLanguage);
    } else {
      this.messages.traceGroup('language', '"defaultLanguage" not set, using default: "' + this.defaultLanguage + '"');
    }
    if (configFlag(config, CEE_CONFIG_KEY.readOnlyMode, false)) {
      handlerContext.enableReadOnlyMode();
    }
    this.translate.setDefaultLang(this.fallbackLanguage);
    this.translate.use(this.defaultLanguage);
    this.reloadLanguageMapsIfSourceMoved(previousPathPrefix, languagesLoadedBefore);
  }

  private reloadLanguageMapsIfSourceMoved(previousPathPrefix: string | null, languagesLoadedBefore: string[]): void {
    if (this.globals.languageMapPathPrefix === previousPathPrefix) {
      return;
    }
    languagesLoadedBefore.forEach((language) =>
      this.translate
        .reloadLang(language)
        .subscribe((translations: TranslationMap) => this.translate.setTranslation(language, translations)),
    );
  }
}
