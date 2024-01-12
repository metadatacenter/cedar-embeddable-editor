import { TemplateComponent } from './template/template-component.model';
import { InstanceFullData } from './instance-full-data.model';

export class DataQualityReport extends Object {
  templateRepresentation: TemplateComponent;
  instanceFullData: InstanceFullData;

  constructor() {
    super();
  }
}
