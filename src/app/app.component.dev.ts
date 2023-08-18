import {Component, OnInit} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {LocalSettingsService} from './modules/shared/service/local-settings.service';
import {environment} from '../environments/environment';

@Component({
  selector: 'app-component-dev',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponentDev implements OnInit {

  ceeConfig = {
    templateDownloadEndpoint: '/download.php',
    templateDownloadParamName: '9ff482bacac84c499655ab58efdf590a',

    sampleTemplateLocationPrefix: 'http://localhost:4240/cedar-embeddable-editor-sample-templates/',
    // sampleTemplateLocationPrefix: 'https://component.staging.metadatacenter.org/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '45',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: true,
    showTemplateRenderingRepresentation: true,
    showHeader: true,
    showFooter: false,

    // terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    // terminologyProxyUrl: 'http://localhost:8000/index.php',
    terminologyProxyUrl: 'https://terminology.metadatacenter.orgx/bioportal/integrated-search',
    showInstanceDataCore: true,
    expandedInstanceDataCore: false,
    showMultiInstanceInfo: true,
    expandedMultiInstanceInfo: false,
    collapseStaticComponents: true,

    showStaticText: true,
  };

  languages = {
    selected: 'en',
    options: [{value: 'en', viewValue: 'en'}, {value: 'hu', viewValue: 'hu'}]
  };


  constructor(
  ) {
  }

  ngOnInit(): void {
  }

  // getCurrentLanguageCode() {
  //   return this.translateService.currentLang;
  // }
  //
  // switchLanguage($event: any, language: string) {
  //   $event.preventDefault();
  //   this.translateService.use(language);
  //   this.localSettings.setLanguage(language);
  // }
  //
  // setLanguage(language: string) {
  //   this.translateService.use(language);
  //   this.localSettings.setLanguage(language);
  // }

}
