import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  ceeConfig = {
    showTemplateUpload: false,
    templateUploadBaseUrl: 'http://localhost:8000',
    // templateUploadBaseUrl: 'https://api-php.cee.metadatacenter.orgx',
    templateUploadEndpoint: '/upload.php',
    templateDownloadEndpoint: '/download.php',
    templateUploadParamName: '3520cf061bba4919a8ea4b74a07af01b',
    templateDownloadParamName: '9ff482bacac84c499655ab58efdf590a',

    showDataSaver: false,
    dataSaverEndpointUrl: 'http://localhost:8000/datasave.php',

    sampleTemplateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    // sampleTemplateLocationPrefix: 'https://component.staging.metadatacenter.org/cedar-embeddable-editor-sample-templates/',
    loadSampleTemplateName: '53',
    showSampleTemplateLinks: false,
    expandedSampleTemplateLinks: true,
    showTemplateRenderingRepresentation: false,

    // terminologyProxyUrl: 'https://api-php.cee.metadatacenter.orgx/index.php',
    // terminologyProxyUrl: 'http://localhost:8000/index.php',
    terminologyProxyUrl: 'https://terminology.metadatacenter.org/bioportal/integrated-search',
    showInstanceDataCore: false,
    expandedInstanceDataCore: true,
    showMultiInstanceInfo: false,
    expandedMultiInstanceInfo: false,
    collapseStaticComponents: true,

    showStaticText: true,
  };

}
