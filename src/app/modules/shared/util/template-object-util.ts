import { CedarModel } from '../models/cedar-model.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';

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
  static hasOwn(obj: unknown, key: PropertyKey): boolean {
    return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
  }
  static getInputType(dataNode: unknown): InputType | undefined {
    if (!this.hasOwn(dataNode, CedarModel.ui)) return;
    const ui = (dataNode as any)[CedarModel.ui];
    if (!this.hasOwn(ui, CedarModel.inputType)) return;
    return (ui as any)[CedarModel.inputType] as InputType | undefined;
  }

  static isLInk(dataNode: object): boolean {
    const inputType = this.getInputType(dataNode);
    return inputType === InputType.link;
  }
  static isExternalAuthorityField(
    dataNode: unknown,
    allowList: ReadonlySet<InputType> = EXTERNAL_AUTHORITY_INPUT_TYPES,
  ): boolean {
    const inputType = this.getInputType(dataNode);
    return !!inputType && allowList.has(inputType);
  }
}
