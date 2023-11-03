export class CedarModel {
  static ui = '_ui';
  static order = 'order';
  static inputType = 'inputType';
  static type = 'type';
  static items = 'items';
  static valueConstraints = '_valueConstraints';
  static requiredValue = 'requiredValue';
  static defaultValue = 'defaultValue';
  static minItems = 'minItems';
  static maxItems = 'maxItems';
  static minLength = 'minLength';
  static maxLength = 'maxLength';
  static numberType = 'numberType';
  static temporalType = 'temporalType';
  static temporalGranularity = 'temporalGranularity';
  static timezoneEnabled = 'timezoneEnabled';
  static inputTimeFormat = 'inputTimeFormat';
  static unitOfMeasure = 'unitOfMeasure';
  static minValue = 'minValue';
  static maxValue = 'maxValue';
  static decimalPlace = 'decimalPlace';
  static content = '_content';

  static ontologies = 'ontologies';
  static valueSets = 'valueSets';
  static classes = 'classes';
  static branches = 'branches';

  static multipleChoice = 'multipleChoice';
  static literals = 'literals';
  static label = 'label';
  static selectedByDefault = 'selectedByDefault';

  static skosPrefLabel = 'skos:prefLabel';
  static propertyDescriptions = 'propertyDescriptions';
  static propertyLabels = 'propertyLabels';

  static format = 'format';
  static enum = 'enum';

  static baseTemplateURL = 'https://schema.metadatacenter.org';
  static templateFieldType = CedarModel.baseTemplateURL + '/core/TemplateField';
  static templateElementType = CedarModel.baseTemplateURL + '/core/TemplateElement';
  static templateStaticFieldType = CedarModel.baseTemplateURL + '/core/StaticTemplateField';
}
