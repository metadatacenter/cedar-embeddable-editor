import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  ceeConfig = {
    sampleTemplateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    // sampleTemplateLocationPrefix: 'https://component.staging.metadatacenter.org/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '01',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: true,

    // terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    terminologyProxyUrl: 'https://terminology.metadatacenter.org/bioportal/integrated-search',
    // showFooter: false,
    // showHeader: false,

    // showTemplateRenderingRepresentation: true,
    // showInstanceDataCore: true,
    // showMultiInstanceInfo: true

    collapseStaticComponents: true
  };

}
