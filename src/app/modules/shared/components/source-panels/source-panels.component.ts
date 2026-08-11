import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { InstanceSerializer } from '../../util/instance-serializer';
import { DataContext } from '../../util/data-context';
import { CedarWriters, Template } from 'cedar-model-typescript-library';
import { CedarTemplate } from '../../models/template/cedar-template.model';

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
    return InstanceSerializer.toJson(this.dataContext.instanceFullData, this.templateModel) as object;
  }

  /** The live instance, written as CEDAR YAML by the model library. */
  get instanceYaml(): string {
    return InstanceSerializer.toYaml(this.dataContext.instanceFullData, this.templateModel);
  }

  /** The source template, written as CEDAR YAML by the model library. */
  get templateYaml(): string {
    const template = this.templateModel;
    return template === null ? '' : CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(template);
  }

  private get templateModel(): Template | null {
    const representation = this.dataContext.templateRepresentation;
    return representation instanceof CedarTemplate ? representation.parsed : null;
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
  @Input() showTemplateYaml = false;
  @Input() showInstanceDataCore = false;
  @Input() showInstanceDataFull = false;
  @Input() showInstanceYaml = false;
  @Input() showDataQualityReport = false;

  @Input() expandedInstanceDataCore = false;
  @Input() expandedInstanceDataFull = false;
  @Input() expandedTemplateSourceData = false;
  @Input() expandedTemplateYaml = false;
  @Input() expandedTemplateRenderingRepresentation = false;
  @Input() expandedMultiInstanceInfo = false;
  @Input() expandedInstanceYaml = false;
  @Input() expandedDataQualityReport = false;

  constructor() {}

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
