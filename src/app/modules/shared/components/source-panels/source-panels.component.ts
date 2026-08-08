import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DataContext } from '../../util/data-context';

@Component({
  selector: 'app-source-panels',
  templateUrl: './source-panels.component.html',
  styleUrls: ['./source-panels.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SourcePanelsComponent {
  @Input() dataContext: DataContext = null;

  @Input() showTemplateRenderingRepresentation: boolean;
  @Input() showMultiInstanceInfo: boolean;
  @Input() showTemplateSourceData: boolean;
  @Input() showInstanceDataCore: boolean;
  @Input() showInstanceDataFull: boolean;
  @Input() showDataQualityReport: boolean;

  @Input() expandedInstanceDataCore = false;
  @Input() expandedInstanceDataFull = false;
  @Input() expandedTemplateSourceData = false;
  @Input() expandedTemplateRenderingRepresentation = false;
  @Input() expandedMultiInstanceInfo = false;
  @Input() expandedDataQualityReport: boolean;

  constructor() {}

  stopPropagation(event): void {
    event.stopPropagation();
  }
}
