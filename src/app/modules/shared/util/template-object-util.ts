import { CedarModel } from '../models/cedar-model.model';
import { InputType } from '../models/input-type.model';

export class TemplateObjectUtil {
  static hasControlledInfo(dataNode: object): boolean {
    if (TemplateObjectUtil.hasValueConstraints(dataNode)) {
      const vc: object = dataNode[CedarModel.valueConstraints];
      const hasOntologies = Object.hasOwn(vc, CedarModel.ontologies) && vc[CedarModel.ontologies].length > 0;
      const hasValueSets = Object.hasOwn(vc, CedarModel.valueSets) && vc[CedarModel.valueSets].length > 0;
      const hasClasses = Object.hasOwn(vc, CedarModel.classes) && vc[CedarModel.classes].length > 0;
      const hasBranches = Object.hasOwn(vc, CedarModel.branches) && vc[CedarModel.branches].length > 0;
      return hasOntologies || hasValueSets || hasClasses || hasBranches;
    }
    return false;
  }

  static hasValueConstraints(dataNode: object): boolean {
    return dataNode != null && Object.hasOwn(dataNode, CedarModel.valueConstraints);
  }

  static isLInk(dataNode: object): boolean {
    if (Object.hasOwn(dataNode, CedarModel.ui)) {
      const ui = dataNode[CedarModel.ui];
      if (Object.hasOwn(ui, CedarModel.inputType)) {
        const inputType = ui[CedarModel.inputType];
        if (inputType === InputType.link) {
          return true;
        }
      }
    }
    return false;
  }
}
