import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-component-dev',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AppDevComponent {
  ceeConfig = {
    // The standalone developer app carries one local sample so it starts from
    // this repository alone. Embedded hosts still provide their own templates.
    sampleTemplateLocationPrefix: '/assets/cee-demo/',
    loadSampleTemplateName: 'demo',
    showSampleTemplateLinks: false,
    expandedSampleTemplateLinks: false,
    showTemplateRenderingRepresentation: true,
    showAllMultiInstanceValues: true,
    showDataQualityReport: true,
    showHeader: true,
    showFooter: true,
    showTemplateDescription: false,

    terminologyIntegratedSearchUrl: 'https://terminology.metadatacenter.orgx/bioportal/integrated-search',
    expandedInstanceDataFull: false,
    showInstanceYaml: true,
    expandedInstanceYaml: false,
    showTemplateYaml: true,
    expandedTemplateYaml: false,
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
    showPreferencesMenu: true,

    extAuthBaseUrl: 'https://bridge.metadatacenter.orgx/ext-auth/',

    orcidIntegratedExtAuthUrl: 'orcid/search-by-name',
    orcidIntegratedDetailsUrl: 'orcid',
    rorIntegratedExtAuthUrl: 'ror/search-by-name',
    rorIntegratedDetailsUrl: 'ror',
    pfasIntegratedExtAuthUrl: 'comp-tox/search-by-name',
    pfasIntegratedDetailsUrl: 'comp-tox',
    pmidIntegratedExtAuthUrl: 'pmid/search-by-name',
    pmidIntegratedDetailsUrl: 'pmid',
    rridIntegratedExtAuthUrl: 'rrid/search-by-name',
    rridIntegratedDetailsUrl: 'rrid',
    nihGrantIntegratedExtAuthUrl: 'nih-grant/search-by-name',
    nihGrantIntegratedDetailsUrl: 'nih-grant',
    doiIntegratedExtAuthUrl: 'doi/search-by-name',
    doiIntegratedDetailsUrl: 'doi',
  };

  languages = {
    selected: 'en',
    options: [
      { value: 'en', viewValue: 'en' },
      { value: 'hu', viewValue: 'hu' },
    ],
  };

  constructor() {}
}
