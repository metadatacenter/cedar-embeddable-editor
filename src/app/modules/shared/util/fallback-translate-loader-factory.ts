import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { MessageHandlerService } from '../service/message-handler.service';
import { BuiltInTranslations, FallbackTranslateLoader } from './fallback-translate-loader';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';

export function FallbackTranslateLoaderFactory(
  http: HttpClient,
  messageHandlerService: MessageHandlerService,
  globalSettingsContextService: GlobalSettingsContextService,
  fallback: BuiltInTranslations,
): TranslateLoader {
  return new FallbackTranslateLoader(http, messageHandlerService, globalSettingsContextService, fallback);
}
