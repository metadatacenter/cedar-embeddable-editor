import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { MessageHandlerService } from '../service/message-handler.service';
import { FallbackTranslateLoader } from './fallback-translate-loader';

export function FallbackTranslateLoaderFactory(
  http: HttpClient,
  messageHandlerService: MessageHandlerService,
  fallback: any,
): TranslateLoader {
  return new FallbackTranslateLoader(http, messageHandlerService, fallback);
}
