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
    showAllMultiInstanceValues: false,
    showDataQualityReport: true,
    showHeader: true,
    showFooter: true,
    showTemplateDescription: false,

    terminologyIntegratedSearchUrl: 'https://terminology.metadatacenter.orgx/bioportal/integrated-search',
    expandedInstanceDataFull: false,
    showInstanceDataCore: true,
    expandedInstanceDataCore: false,
    showMultiInstanceInfo: true,
    expandedMultiInstanceInfo: false,
    expandedDataQualityReport: false,
    languageMapPathPrefix: '/assets/i18n-cee/',
    defaultLanguage: 'en',
    fallbackLanguage: 'en',

    iriPrefix: 'https://repo.metadatacenter.orgx/',
    bioPortalPrefix: 'https://bioportal.bioontology.org/ontologies/',
    orcidPrefix: 'https://orcid.org/',
    rorPrefix: 'https://ror.org/',

    collapseStaticComponents: true,
    // showStaticText: true,
    readOnlyMode: false,
    hideEmptyFields: false,
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
