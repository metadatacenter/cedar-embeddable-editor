import { JsonSchema } from '../models/json-schema.model';
import { CedarModel } from '../models/cedar-model.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { NullTemplate } from '../models/template/null-template.model';
import { EmptyTemplate } from '../models/template/empty-template.model';
import { TemplateComponent } from '../models/template/template-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';
import { ComponentTypeHandler } from '../handler/component-type.handler';
import { InputType } from '../models/input-type.model';
import { TemplateObjectUtil } from '../util/template-object-util';
import { HandlerContext } from '../util/handler-context';

export class TemplateRepresentationFactory {
  static create(
    inputTemplate: CedarInputTemplate,
    collapseStaticComponents: boolean,
    handlerContext: HandlerContext,
  ): TemplateComponent {
    if (inputTemplate === null) {
      return new NullTemplate();
    } else {
      const template = new CedarTemplate();
      TemplateRepresentationFactory.wrap(
        inputTemplate,
        inputTemplate,
        template,
        [],
        collapseStaticComponents,
        handlerContext,
      );
      // this.removeEmpty(template);
      TemplateRepresentationFactory.extractTemplateLabels(inputTemplate, template);
      TemplateRepresentationFactory.extractPageBreakPages(template);
      return template;
    }
  }
  static removeEmpty(template: CedarTemplate) {
    const children = template.children;
    for (let i = 0; i < children.length; i) {
      const ch = children[i] as ElementComponent;
      if (!ch.children.length) {
        children.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  static extractPageBreakPages(template: CedarTemplate): void {
    const pages = [];
    let page = [];
    let numPBInRow = 0;

    template.children.forEach((child, index) => {
      // encountered page-break component
      if (
        child instanceof StaticFieldComponent &&
        (child as StaticFieldComponent).basicInfo.inputType === InputType.pageBreak
      ) {
        if (page.length) {
          pages.push(page);
        }
        // if page-break is the last component, always add an empty page
        if (index === template.children.length - 1) {
          pages.push([new EmptyTemplate()]);
        } else {
          numPBInRow++;
        }
        page = [];
      } else {
        page.push(child);

        if (index === template.children.length - 1) {
          pages.push(page);
        }

        // add empty pages corresponding to: (number of page breaks in a row - 1)
        for (let i = 0; i < numPBInRow - 1; i++) {
          pages.push([new EmptyTemplate()]);
        }
        numPBInRow = 0;
      }
    });
    template.pageBreakChildren = pages;
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
    collapseStaticComponents: boolean,
    handlerContext: HandlerContext,
  ): void {
    // const propertyNames: string[] = TemplateRepresentationFactory.getFilteredSchemaPropertyNames(templateJsonObj);
    // console.log(propertyNames);
    const propertyNames: string[] = TemplateRepresentationFactory.getOrderedPropertyNames(templateJsonObj);
    for (const name of propertyNames) {
      const templateFragment = templateJsonObj[JsonSchema.properties][name];

      const isMulti: boolean = TemplateRepresentationFactory.isFragmentMulti(templateFragment);

      const parentDataNode: object = TemplateRepresentationFactory.getDataNode(parentJsonObj);
      const dataNode: object = TemplateRepresentationFactory.getDataNode(templateFragment);
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

        TemplateRepresentationFactory.extractValueConstraints(dataNode, r as FieldComponent);
        TemplateRepresentationFactory.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
      } else if (fragmentAtType === CedarModel.templateElementType) {
        if (isMulti) {
          r = new MultiElementComponent();
        } else {
          r = new SingleElementComponent();
        }
        TemplateRepresentationFactory.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
        TemplateRepresentationFactory.wrap(
          dataNode,
          templateJsonObj,
          r,
          myPath,
          collapseStaticComponents,
          handlerContext,
        );
      } else if (fragmentAtType === CedarModel.templateStaticFieldType) {
        r = new StaticFieldComponent();
        TemplateRepresentationFactory.extractStaticData(dataNode, parentDataNode, name, r as StaticFieldComponent);
      }

      if (r !== null) {
        const wrapperElement: ElementComponent = component as ElementComponent;
        if (r instanceof SingleFieldComponent || r instanceof MultiFieldComponent) {
          const val = this.getValueByPath(myPath, handlerContext.dataContext.instanceExtractData);
          // const def = r as SingleFieldComponent;
          // const defaultValue = def.valueInfo.defaultValue;
          console.log('Wrapper element', wrapperElement);
          if (val || wrapperElement instanceof MultiElementComponent) {
            wrapperElement.children.push(r);
            r.name = name;
            r.path = myPath;
          }
        } else if (r instanceof MultiElementComponent || r instanceof SingleElementComponent) {
          if (r.children.length) {
            wrapperElement.children.push(r);
            r.name = name;
            r.path = myPath;
            // console.log(r.name, 'has children');
          }
        } else {
          wrapperElement.children.push(r);
          r.name = name;
          r.path = myPath;
        }
      }

      if (isMulti) {
        const mr = r as MultiComponent;
        TemplateRepresentationFactory.extractMultiInfo(templateFragment, mr);
      }
    }

    if (collapseStaticComponents) {
      this.collapseStaticFieldsIntoNextFieldOrElement(component);
    }
  }
  // private static getDefaultValueByPath(path: string[], templateRep: CedarTemplate) {}

  private static getValueByPath(path: string[], json) {
    if (path.length === 0) {
      if (Object.prototype.hasOwnProperty.call(json, '@value')) {
        return json['@value'];
      } else if (Object.prototype.hasOwnProperty.call(json, '@id')) {
        return json['@id'];
      } else return null;
    }
    const currentKey = path[0];
    const remainingPath = path.slice(1);
    if (Object.prototype.hasOwnProperty.call(json, currentKey)) {
      const value = json[currentKey];
      if (value instanceof Array) {
        if (!value.length) {
          return null;
        }
        return this.getValueByPath(remainingPath, value[0]);
      } else {
        return this.getValueByPath(remainingPath, value);
      }
    }
  }
  // private static getFilteredSchemaPropertyNames(jsonObj: object): string[] {
  //   const names: string[] = [];
  //   if (jsonObj.hasOwnProperty(JsonSchema.properties)) {
  //     const prMap = jsonObj[JsonSchema.properties];
  //     if (prMap instanceof Object) {
  //       for (const name of Object.keys(prMap)) {
  //         if (!JsonSchema.builtInProperties.has(name)) {
  //           names.push(name);
  //         }
  //       }
  //     }
  //   }
  //   return names;
  // }

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
    const isMulti: boolean = TemplateRepresentationFactory.isFragmentMulti(templateFragment);
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

  private static extractTemplateLabels(templateJsonObj: object, template: CedarTemplate): void {
    template.labelInfo.label = templateJsonObj[JsonSchema.schemaName];
    template.labelInfo.description = templateJsonObj[JsonSchema.schemaDescription];
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

  // Group RTF/image/video fields into consecutive pairs. Any pair gets combined
  // and displayed inline wherever it's located.
  // If the RTF/image/video field is odd (not paired with another RTF/image/video),
  // wrap this field into the next dynamic field/element
  private static collapseStaticFieldsIntoNextFieldOrElement(component: CedarComponent): void {
    // re-iterate, inject static components (images) into the next dynamic components
    // but only if they aren't paired with other like fields
    if (ComponentTypeHandler.isContainerComponent(component)) {
      const elementComponent = component as ElementComponent;
      let prevChild: CedarComponent = null;
      const newChildren: CedarComponent[] = [];
      let isStaticPair = false;

      for (let i = 0; i < elementComponent.children.length; i++) {
        const currentChild: CedarComponent = elementComponent.children[i];

        if (
          ComponentTypeHandler.isFieldOrElement(currentChild) &&
          ComponentTypeHandler.isStaticContentComponent(prevChild) &&
          !isStaticPair
        ) {
          currentChild.linkedStaticFieldComponent = prevChild as StaticFieldComponent;
          newChildren.pop();
          newChildren.push(currentChild);
        } else {
          newChildren.push(currentChild);
        }

        if (
          !isStaticPair &&
          ComponentTypeHandler.isStaticContentComponent(currentChild) &&
          ComponentTypeHandler.isStaticContentComponent(prevChild)
        ) {
          isStaticPair = true;
        } else if (isStaticPair) {
          isStaticPair = false;
        }
        prevChild = currentChild;
      }
      elementComponent.children = newChildren;
    }
  }
}
