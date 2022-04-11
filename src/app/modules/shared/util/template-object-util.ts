import {CedarModel} from '../models/cedar-model.model';

export class TemplateObjectUtil {

  static hasControlledInfo(dataNode: object): boolean {
    if (TemplateObjectUtil.hasValueConstraints(dataNode)) {
      const vc: object = dataNode[CedarModel.valueConstraints];
      const hasOntologies = vc.hasOwnProperty(CedarModel.ontologies) && vc[CedarModel.ontologies].length > 0;
      const hasValueSets = vc.hasOwnProperty(CedarModel.valueSets) && vc[CedarModel.valueSets].length > 0;
      const hasClasses = vc.hasOwnProperty(CedarModel.classes) && vc[CedarModel.classes].length > 0;
      const hasBranches = vc.hasOwnProperty(CedarModel.branches) && vc[CedarModel.branches].length > 0;
      return hasOntologies || hasValueSets || hasClasses || hasBranches;
    }
    return false;
  }

  static hasValueConstraints(dataNode: object): boolean {
    return dataNode != null && dataNode.hasOwnProperty(CedarModel.valueConstraints);
  }

}
