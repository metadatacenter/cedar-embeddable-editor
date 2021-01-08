import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  ceeConfig = {
    sampleTemplateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '01',
    showSampleTemplateLinks: true,
    expandedSampleTemplateLinks: true,

    terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    // showFooter: false,
    // showHeader: false,

    // showTemplateRenderingRepresentation: true,
    // showInstanceDataCore: true,
    // showMultiInstanceInfo: true

    collapseStaticComponents: true
  };

}
