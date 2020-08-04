import {Component, Input, OnInit} from '@angular/core';
import {TemplateComponent} from '../../models/template/template-component.model';

@Component({
  selector: 'app-source-panels',
  templateUrl: './source-panels.component.html',
  styleUrls: ['./source-panels.component.scss']
})
export class SourcePanelsComponent implements OnInit {

  @Input() templateJson: object = null;
  @Input() templateRepresentationString: string = null;
  @Input() templateRepresentation: TemplateComponent = null;
  @Input() templateJsonString: string = null;
  @Input() instanceData: object = null;
  @Input() instanceDataString: string = null;

  constructor() {
  }

  ngOnInit(): void {
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }

}
