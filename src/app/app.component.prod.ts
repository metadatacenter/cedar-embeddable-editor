import {Component, OnInit} from '@angular/core';
import {LocalSettingsService} from './modules/shared/service/local-settings.service';
import {TranslateService} from '@ngx-translate/core';
import {environment} from '../environments/environment';

@Component({
  selector: 'app-component-prod',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponentProd implements OnInit {

  ceeConfig = {
    showTemplateUpload: true,
    templateUploadBaseUrl: 'http://localhost:8000',
    // templateUploadBaseUrl: 'https://api-php.cee.metadatacenter.orgx',
    templateUploadEndpoint: '/upload.php',
    templateDownloadEndpoint: '/download.php',
    templateUploadParamName: '3520cf061bba4919a8ea4b74a07af01b',
    templateDownloadParamName: '9ff482bacac84c499655ab58efdf590a',

    showDataSaver: true,
    dataSaverEndpointUrl: 'http://localhost:8000/datasave.php',

    sampleTemplateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    // sampleTemplateLocationPrefix: 'https://component.staging.metadatacenter.org/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '45',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: true,
    showTemplateRenderingRepresentation: true,
    showHeader: false,
    showFooter: false,

    // terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    // terminologyProxyUrl: 'http://localhost:8000/index.php',
    terminologyProxyUrl: 'https://terminology.metadatacenter.org/bioportal/integrated-search',
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
