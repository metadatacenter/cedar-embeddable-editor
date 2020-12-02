import {Component} from '@angular/core';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  ceeConfig = {
    templateLocationPrefix: 'https://component.metadatacenter.orgx/cedar-embeddable-editor-sample-templates/',
    showSampleTemplateLinks: true,
    showTemplateRenderingRepresentation: true
  };

}
