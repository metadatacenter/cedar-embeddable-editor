import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-component-dev',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponentDev implements OnInit {
  ceeConfig = {
    sampleTemplateLocationPrefix: 'http://localhost:4240/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '71',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: false,
    showTemplateRenderingRepresentation: true,
    showHeader: true,
    showFooter: true,

    terminologyIntegratedSearchUrl: 'https://terminology.metadatacenter.orgx/bioportal/integrated-search',
    showInstanceDataCore: true,
    expandedInstanceDataCore: false,
    showMultiInstanceInfo: true,
    expandedMultiInstanceInfo: false,

    defaultLanguage: 'en',
    fallbackLanguage: 'en',

    iriPrefix: 'https://repo.metadatacenter.orgx/',

    // collapseStaticComponents: false,
    // showStaticText: true,
  };

  languages = {
    selected: 'en',
    options: [
      { value: 'en', viewValue: 'en' },
      { value: 'hu', viewValue: 'hu' },
    ],
  };

  constructor() {}

  ngOnInit(): void {}
}
