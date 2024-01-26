import { TemplateComponent } from './template/template-component.model';
import { InstanceExtractData } from './instance-extract-data.model';

export class DataQualityReport extends Object {
  templateRepresentation: TemplateComponent;
  instanceExtractData: InstanceExtractData;
  valueTree: object;
  requiredFieldValueCount = 0;
  nonNullRequiredFieldValueCount = 0;
  isValid = false;

  constructor() {
    super();
  }

  computeValidity() {
    if (this.requiredFieldValueCount <= this.nonNullRequiredFieldValueCount) {
      this.isValid = true;
    }
  }
}
