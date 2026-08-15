import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CeeJsonObject, CeeTemplateAndInstance } from './cee-public-api';

@Component({
  selector: 'app-component-dev',
  templateUrl: './app.component.dev.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AppDevComponent implements OnInit {
  /**
   * The demo artifact, fetched the way any host fetches its own.
   *
   * CEE used to load this itself, given a location prefix and a name. That was
   * the one path where CEE reached the network for an artifact, and it existed
   * for this app. The developer app is a host like any other, so it does what a
   * host does: fetch, then assign. Null until then, which the input ignores.
   */
  artifact: CeeTemplateAndInstance | null = null;

  ceeConfig = {
    showTemplateDescription: true,
    showDownloadMenu: true,

    terminologyIntegratedSearchUrl: 'https://terminology.metadatacenter.orgx/bioportal/integrated-search',
    languageMapPathPrefix: '/assets/i18n-cee/',
    defaultLanguage: 'en',
    fallbackLanguage: 'en',

    iriPrefix: 'https://repo.metadatacenter.orgx/',

    readOnlyMode: false,

    extAuthBaseUrl: 'https://bridge.metadatacenter.orgx/ext-auth/',
  };

  languages = {
    selected: 'en',
    options: [
      { value: 'en', viewValue: 'en' },
      { value: 'hu', viewValue: 'hu' },
    ],
  };

  constructor() {}

  async ngOnInit(): Promise<void> {
    const load = async (file: string): Promise<CeeJsonObject> => (await fetch(`/assets/cee-demo/demo/${file}`)).json();
    const [templateObject, instanceObject] = await Promise.all([load('template.json'), load('metadata.json')]);
    // Both at once, so the form is built with the instance already read. Two
    // separate assignments would build it from the template alone.
    this.artifact = { templateObject, instanceObject };
  }
}
