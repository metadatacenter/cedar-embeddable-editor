import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { InstanceSerializer } from '../../util/instance-serializer';
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

  /**
   * The instance as a document, which is what this panel shows and what its
   * copy button puts on the clipboard.
   *
   * It used to render `dataContext.instanceExtractData` straight through the
   * `json` pipe. That was the working tree without its envelope, and the working
   * tree was a document, so piping it showed a user their instance. It is a
   * model now, and piping a model shows `_values` and `_iris` — CEE's internals,
   * offered to someone as their metadata.
   */
  get instanceJson(): object {
    return InstanceSerializer.toJson(this.dataContext.instanceFullData) as object;
  }

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
