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
  @Input({ required: true }) dataContext!: DataContext;

  /*
   * All twelve default to false — a panel nobody asked for is closed, and one the
   * host has not enabled is absent. That is what the editor above already declares
   * for each of these, so the two agree rather than one relying on the other always
   * binding. Six of them said `boolean` and were `undefined` until bound, which the
   * templates read as false anyway.
   */
  @Input() showTemplateRenderingRepresentation = false;
  @Input() showMultiInstanceInfo = false;
  @Input() showTemplateSourceData = false;
  @Input() showInstanceDataCore = false;
  @Input() showInstanceDataFull = false;
  @Input() showDataQualityReport = false;

  @Input() expandedInstanceDataCore = false;
  @Input() expandedInstanceDataFull = false;
  @Input() expandedTemplateSourceData = false;
  @Input() expandedTemplateRenderingRepresentation = false;
  @Input() expandedMultiInstanceInfo = false;
  @Input() expandedDataQualityReport = false;

  constructor() {}

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
