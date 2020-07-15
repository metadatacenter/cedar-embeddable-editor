import {TemplateRepresentation} from '../models/template-representation.model';
import {NullTemplateRepresentation} from '../models/null-template-representation.model';

export class TemplateRepresentationFactory {

  static create(templateJsonObj: object): TemplateRepresentation {
    return new NullTemplateRepresentation();
  }

}
