import {CedarModel} from '../models/cedar-model.model';

export class TemplateObjectUtil {

  static hasControlledInfo(dataNode: object): boolean {
    if (dataNode != null && dataNode.hasOwnProperty(CedarModel.valueConstraints)) {
      const vc: object = dataNode[CedarModel.valueConstraints];
      return vc.hasOwnProperty(CedarModel.ontologies)
        || vc.hasOwnProperty(CedarModel.valueSets)
        || vc.hasOwnProperty(CedarModel.classes)
        || vc.hasOwnProperty(CedarModel.branches);
    }
    return false;
  }

  static hasValueConstraints(dataNode: object): boolean {
    return dataNode != null && dataNode.hasOwnProperty(CedarModel.valueConstraints);
  }
}
