import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-component-prod',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponentProd implements OnInit {

  ceeConfig = {
    sampleTemplateLocationPrefix: 'https://component.metadatacenter.org/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '45',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: true,
    showTemplateRenderingRepresentation: true,
    showHeader: false,
    showFooter: false,

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


  constructor() {
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
