import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  ceeConfig = {
    sampleTemplateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    showSampleTemplateLinks: true,
    loadSampleTemplateName: '03',
    terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    showTemplateRenderingRepresentation: true,
    showInstanceDataCore: true
  };

}
