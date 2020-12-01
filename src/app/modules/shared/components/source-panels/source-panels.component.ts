import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {DataContext} from '../../util/data-context';

@Component({
  selector: 'app-source-panels',
  templateUrl: './source-panels.component.html',
  styleUrls: ['./source-panels.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SourcePanelsComponent implements OnInit {

  @Input() dataContext: DataContext = null;

  @Input() showTemplateRenderingRepresentation: boolean;
  @Input() showMultiInstanceInfo: boolean;
  @Input() showTemplateSourceData: boolean;
  @Input() showInstanceDataCore: boolean;
  @Input() showInstanceDataFull: boolean;

  constructor() {
  }

  ngOnInit(): void {
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }

}
