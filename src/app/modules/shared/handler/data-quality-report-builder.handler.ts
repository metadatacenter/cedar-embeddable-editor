import { TemplateComponent } from '../models/template/template-component.model';
import { DataQualityReport } from '../models/data-quality-report.model';
import { DataContext } from '../util/data-context';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';
import * as _ from 'lodash-es';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { MultiInstanceInfo } from '../models/info/multi-instance-info.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../util/handler-context';
import { JsonSchema } from '../models/json-schema.model';
import { InputType } from '../models/input-type.model';

export class DataQualityReportBuilderHandler {
  private dataObjectFull: object;
  private templateRepresentation: TemplateComponent;
  private report: DataQualityReport;

  buildReport(dataContext: DataContext, handlerContext: HandlerContext): DataQualityReport {
    this.report = new DataQualityReport();
    this.report.templateRepresentation = dataContext.templateRepresentation;
    this.report.instanceExtractData = dataContext.instanceExtractData;

    const valueTree = {};

    if (dataContext.templateRepresentation != null && dataContext.templateInput != null) {
      DataQualityReportBuilderHandler.buildRecursively(
        dataContext.templateRepresentation,
        this.report,
        valueTree,
        dataContext.multiInstanceData,
        handlerContext,
      );
    }
    this.report.valueTree = valueTree['undefined'];
    this.report.computeValidity();
    return this.report;
  }

  private static buildRecursively(
    component: CedarComponent,
    report: DataQualityReport,
    valueTree: object,
    multiInstanceInfo: MultiInstanceInfo,
    handlerContext: HandlerContext,
  ): void {
    let ret = null;
    if (
      component instanceof SingleElementComponent ||
      component instanceof MultiElementComponent ||
      component instanceof CedarTemplate
    ) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      const targetName = iterableComponent.name;
      if (component instanceof MultiElementComponent) {
        //const multiElement: MultiElementComponent = component as MultiElementComponent;
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyList();
        const multiCount = (multiInstanceInfo as any as MultiInstanceObjectInfo).currentCount;
        if (multiCount > 0) {
          const dummyTargetObject: object = DataQualityReportBuilderHandler.getEmptyObject();
          const currentIndex = (multiInstanceInfo as any as MultiInstanceObjectInfo).currentIndex;
          for (const childComponent of iterableComponent.children) {
            DataQualityReportBuilderHandler.buildRecursively(
              childComponent,
              report,
              dummyTargetObject,
              multiInstanceInfo['children'][currentIndex][childComponent.name],
              handlerContext,
            );
          }
          const multiCount = (multiInstanceInfo as any as MultiInstanceObjectInfo).currentCount;
          for (let idx = 0; idx < multiCount; idx++) {
            const clone = _.cloneDeep(dummyTargetObject as any);
            valueTree[targetName]['values'].push(clone);
          }
        }
      } else {
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyObject();
        for (const childComponent of iterableComponent.children) {
          let nextMultiInstanceInfo = multiInstanceInfo[childComponent.name];
          if (nextMultiInstanceInfo == undefined) {
            nextMultiInstanceInfo = multiInstanceInfo['children'][0][childComponent.name];
          }
          DataQualityReportBuilderHandler.buildRecursively(
            childComponent,
            report,
            valueTree[targetName],
            nextMultiInstanceInfo,
            handlerContext,
          );
        }
      }
      ret = valueTree[targetName];
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      let isRequired = false;
      if (component.valueInfo.requiredValue) {
        isRequired = true;
      }
      const dataValueObject: object = handlerContext.getDataObjectNodeByPath(component.path);
      if (component instanceof MultiFieldComponent) {
        const multiField: MultiFieldComponent = component as MultiFieldComponent;
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyList();
        if (multiField.multiInfo.minItems > 0) {
          const multiCount = (multiInstanceInfo as any as MultiInstanceObjectInfo).currentCount;
          for (let idx = 0; idx < multiCount; idx++) {
            const value = DataQualityReportBuilderHandler.extractPlainValue(dataValueObject[idx], component);
            valueTree[targetName]['values'].push(
              DataQualityReportBuilderHandler.getEmptyValueWrapper(value, isRequired, report),
            );
          }
        }
      } else {
        const value = DataQualityReportBuilderHandler.extractPlainValue(dataValueObject, component);
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyValueWrapper(value, isRequired, report);
      }
      ret = valueTree[targetName];
    }
    return ret;
  }

  private static getEmptyValueWrapper(value: object, isRequired: boolean, report: DataQualityReport) {
    const v = { value: value };
    if (isRequired) {
      v['required'] = true;
      report.requiredFieldValueCount++;
      if (value !== null) {
        report.nonNullRequiredFieldValueCount++;
      }
    }
    return v;
  }

  private static getSingleValueWrapper() {
    return {};
  }

  private static getEmptyList() {
    return { values: [] };
  }

  private static getEmptyObject() {
    return {};
  }

  private static extractPlainValue(dataObject: object, component: SingleFieldComponent | MultiFieldComponent) {
    if (dataObject == undefined || dataObject == null) {
      return null;
    }
    if (Object.hasOwn(dataObject, JsonSchema.atValue)) {
      return dataObject[JsonSchema.atValue];
    } else if (Object.hasOwn(dataObject, JsonSchema.atId) && component.basicInfo.inputType === InputType.link) {
      // url field single
      return dataObject[JsonSchema.atId];
    } else if (Object.hasOwn(dataObject, JsonSchema.atId)) {
      // controlled field single
      return dataObject[JsonSchema.rdfsLabel];
    }
  }
}
