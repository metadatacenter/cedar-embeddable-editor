import { JsonSchema } from '../models/json-schema.model';
import { CedarModel } from '../models/cedar-model.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';
import { InputType } from '../models/input-type.model';
import { TemplateObjectUtil } from '../util/template-object-util';
import { HandlerContext } from '../util/handler-context';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { DataObjectUtil } from '../util/data-object-util';
import { TemplateParser } from './template-parser';

/**
 * CEE's original template parser: a hand-written walk over the raw JSON.
 *
 * Lifted out of `TemplateRepresentationFactory` unchanged, so that the tree it
 * builds can be compared against the one the model library produces. It reads
 * the CEDAR vocabulary through CEE's own copy of the key constants
 * (`CedarModel`, `JsonSchema`), which is the duplication the library-backed
 * parser exists to remove.
 */
export class JsonWalkTemplateParser implements TemplateParser {
  parse(templateJson: object, template: CedarTemplate, handlerContext: HandlerContext): void {
    JsonWalkTemplateParser.wrap(templateJson, templateJson, template, [], handlerContext);
    JsonWalkTemplateParser.copyContext(templateJson, template);
    template.labelInfo.label = templateJson[JsonSchema.schemaName];
    template.labelInfo.description = templateJson[JsonSchema.schemaDescription];
  }

  private static isFragmentMulti(templateFragment: object): boolean {
    const fragmentType = templateFragment[CedarModel.type];

    if (fragmentType === JavascriptTypes.object) {
      return false;
    } else if (fragmentType === JavascriptTypes.array) {
      return true;
    } else {
      throw new Error(
        'Invalid node value of ' +
          CedarModel.type +
          '. Value found:"' +
          fragmentType +
          '". ' +
          'Expected "' +
          JavascriptTypes.object +
          '" or "' +
          JavascriptTypes.array +
          '"!',
      );
    }
  }

  private static wrap(
    templateJsonObj: object,
    parentJsonObj: object,
    component: CedarComponent,
    parentPath: string[],
    handlerContext: HandlerContext,
  ): void {
    const propertyNames: string[] = JsonWalkTemplateParser.getOrderedPropertyNames(templateJsonObj);
    for (const name of propertyNames) {
      const templateFragment = templateJsonObj[JsonSchema.properties][name];

      if (templateFragment == null) {
        // `_ui.order` can name a child that `properties` does not define. That
        // happens in real templates — `template-003` in cedar-test-artifacts is
        // one, and the model library reads it without complaint — so skipping
        // the orphan is the right response. Passing it on made
        // `isFragmentMulti` dereference `.type` on undefined and take the whole
        // editor down over a template it could otherwise have rendered.
        handlerContext.messageHandlerService.error(
          `Template lists "${name}" in _ui.order but has no such property. Skipping it.`,
        );
        continue;
      }

      const isMulti: boolean = JsonWalkTemplateParser.isFragmentMulti(templateFragment);

      const parentDataNode: object = JsonWalkTemplateParser.getDataNode(parentJsonObj);
      const dataNode: object = JsonWalkTemplateParser.getDataNode(templateFragment);
      const fragmentAtType = dataNode[JsonSchema.atType];
      let r: CedarComponent = null;

      const myPath: string[] = parentPath.slice();
      myPath.push(name);

      if (fragmentAtType === CedarModel.templateFieldType) {
        if (isMulti) {
          r = new MultiFieldComponent();
        } else {
          r = new SingleFieldComponent();
        }

        JsonWalkTemplateParser.extractValueConstraints(dataNode, r as FieldComponent);
        JsonWalkTemplateParser.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
      } else if (fragmentAtType === CedarModel.templateElementType) {
        if (isMulti) {
          r = new MultiElementComponent();
        } else {
          r = new SingleElementComponent();
        }
        JsonWalkTemplateParser.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
        JsonWalkTemplateParser.wrap(dataNode, templateJsonObj, r, myPath, handlerContext);
        JsonWalkTemplateParser.copyContext(dataNode, r as AbstractElementComponent);
      } else if (fragmentAtType === CedarModel.templateStaticFieldType) {
        r = new StaticFieldComponent();
        JsonWalkTemplateParser.extractStaticData(dataNode, parentDataNode, name, r as StaticFieldComponent);
      }

      if (r !== null) {
        const wrapperElement: ElementComponent = component as ElementComponent;
        if (!dataNode['_ui'].hidden) {
          wrapperElement.children.push(r);
          r.name = name;
          r.path = myPath;
        }
      }
      if (isMulti) {
        const mr = r as MultiComponent;
        JsonWalkTemplateParser.extractMultiInfo(templateFragment, mr);
      }
    }
  }

  /**
   * Copy the container's declared `@context` entries verbatim.
   *
   * Verbatim including anything odd in them — `template-003` carries an
   * `rdfs--` prefix and an IRI for a property it does not define, and both come
   * straight through. That is what CEE has always done; the library-backed
   * parser generates the block instead.
   */
  private static copyContext(containerJson: object, container: AbstractElementComponent): void {
    const props = containerJson?.[JsonSchema.properties];
    const propsContext = props?.[JsonSchema.atContext];
    const propsContextProps = propsContext?.[JsonSchema.properties];
    if (propsContextProps == null) {
      return;
    }
    const entries: Record<string, unknown> = {};
    for (const key of Object.keys(propsContextProps)) {
      entries[key] = DataObjectUtil.convertTemplateContextNode(propsContextProps[key]);
    }
    container.contextEntries = entries;
  }

  private static getOrderedPropertyNames(jsonObj: object): string[] {
    const order: string[] = [];
    if (Object.hasOwn(jsonObj, CedarModel.ui)) {
      const uiMap = jsonObj[CedarModel.ui];
      if (Object.hasOwn(uiMap, CedarModel.order)) {
        return uiMap[CedarModel.order];
      }
    }
    return order;
  }

  private static getDataNode(templateFragment: object): object {
    if (templateFragment == null) {
      return null;
    }
    const isMulti: boolean = JsonWalkTemplateParser.isFragmentMulti(templateFragment);
    if (isMulti) {
      return templateFragment[CedarModel.items];
    } else {
      return templateFragment;
    }
  }

  private static extractValueConstraints(dataNode: object, fc: FieldComponent): void {
    fc.basicInfo.inputType = dataNode[CedarModel.ui][CedarModel.inputType];

    if (dataNode[CedarModel.ui][CedarModel.inputType] === InputType.temporal) {
      if (Object.hasOwn(dataNode[CedarModel.ui], CedarModel.timezoneEnabled)) {
        fc.basicInfo.timezoneEnabled = dataNode[CedarModel.ui][CedarModel.timezoneEnabled];
      }
      if (Object.hasOwn(dataNode[CedarModel.ui], CedarModel.inputTimeFormat)) {
        fc.basicInfo.inputTimeFormat = dataNode[CedarModel.ui][CedarModel.inputTimeFormat];
      }
      if (Object.hasOwn(dataNode[CedarModel.ui], CedarModel.temporalGranularity)) {
        fc.basicInfo.temporalGranularity = dataNode[CedarModel.ui][CedarModel.temporalGranularity];
      }
    }

    if (Object.hasOwn(dataNode[CedarModel.ui], CedarModel.temporalGranularity)) {
      fc.basicInfo.temporalGranularity = dataNode[CedarModel.ui][CedarModel.temporalGranularity];
    }

    if (TemplateObjectUtil.hasValueConstraints(dataNode)) {
      const vc: object = dataNode[CedarModel.valueConstraints];
      fc.valueInfo.requiredValue = vc[CedarModel.requiredValue];
      fc.valueInfo.defaultValue = vc[CedarModel.defaultValue];
      fc.valueInfo.minLength = vc[CedarModel.minLength];
      fc.valueInfo.maxLength = vc[CedarModel.maxLength];
      fc.valueInfo.regex = vc[CedarModel.regex];

      if (Object.hasOwn(vc, CedarModel.temporalType)) {
        fc.valueInfo.temporalType = vc[CedarModel.temporalType];
      }

      fc.numberInfo.numberType = vc[CedarModel.numberType];
      fc.numberInfo.unitOfMeasure = vc[CedarModel.unitOfMeasure];
      fc.numberInfo.minValue = vc[CedarModel.minValue];
      fc.numberInfo.maxValue = vc[CedarModel.maxValue];
      fc.numberInfo.decimalPlace = vc[CedarModel.decimalPlace];
      fc.choiceInfo.multipleChoice = vc[CedarModel.multipleChoice];

      if (vc[CedarModel.literals] !== undefined) {
        for (const pair of vc[CedarModel.literals]) {
          const option = new ChoiceOption();
          option.label = pair[CedarModel.label];
          option.selectedByDefault = pair[CedarModel.selectedByDefault];
          fc.choiceInfo.choices.push(option);
        }
      }

      if (TemplateObjectUtil.hasControlledInfo(dataNode)) {
        fc.basicInfo.inputType = InputType.controlled;
        fc.controlledInfo.ontologies = vc[CedarModel.ontologies];
        fc.controlledInfo.valueSets = vc[CedarModel.valueSets];
        fc.controlledInfo.classes = vc[CedarModel.classes];
        fc.controlledInfo.branches = vc[CedarModel.branches];
      }
    }
  }

  private static extractLabels(dataNode: object, parentDataNode: object, name: string, fc: FieldComponent): void {
    fc.labelInfo.preferredLabel = dataNode[CedarModel.skosPrefLabel];
    fc.labelInfo.description = dataNode[JsonSchema.schemaDescription];
    fc.labelInfo.label = dataNode[JsonSchema.schemaName];
    if (parentDataNode != null) {
      if (fc.labelInfo.description == null || fc.labelInfo.description === 'Help Text') {
        if (parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions] !== undefined) {
          fc.labelInfo.description = parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions][name];
        }
      }
      if (fc.labelInfo.label == null || fc.labelInfo.label === name) {
        if (parentDataNode[CedarModel.ui][CedarModel.propertyLabels] !== undefined) {
          fc.labelInfo.label = parentDataNode[CedarModel.ui][CedarModel.propertyLabels][name];
        }
      }
    }
  }

  private static extractMultiInfo(templateFragment: object, mr: MultiComponent): void {
    mr.multiInfo.minItems = templateFragment[CedarModel.minItems];
    mr.multiInfo.maxItems = templateFragment[CedarModel.maxItems];
  }

  private static extractStaticData(
    dataNode: object,
    parentDataNode: object,
    name: string,
    sfc: StaticFieldComponent,
  ): void {
    sfc.basicInfo.inputType = dataNode[CedarModel.ui][CedarModel.inputType];
    sfc.labelInfo.preferredLabel = dataNode[CedarModel.skosPrefLabel];
    sfc.contentInfo.content = dataNode[CedarModel.ui][CedarModel.content];
    sfc.labelInfo.description = dataNode[JsonSchema.schemaDescription];
    sfc.labelInfo.label = dataNode[JsonSchema.schemaName];
    if (parentDataNode != null) {
      if (sfc.labelInfo.description == null || sfc.labelInfo.description === 'Help Text') {
        if (parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions] !== undefined) {
          sfc.labelInfo.description = parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions][name];
        }
      }
      if (sfc.labelInfo.label == null || sfc.labelInfo.label === name) {
        if (parentDataNode[CedarModel.ui][CedarModel.propertyLabels] !== undefined) {
          sfc.labelInfo.label = parentDataNode[CedarModel.ui][CedarModel.propertyLabels][name];
        }
      }
    }
  }
}
