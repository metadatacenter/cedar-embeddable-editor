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
import { InstanceValueNode } from '../util/instance-value-node';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { FieldValueValidator } from '../validation/field-value-validator';
import { ValidationCode, ValidationProblem } from '../validation/validation-problem.model';

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
        DataQualityReportBuilderHandler.collectCardinalityProblems(component as any, multiCount, report);
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
      // Whether a requirement is satisfied is asked of the whole instance, not
      // of the page currently on screen. See findAnyValue.
      const satisfiedBy = isRequired
        ? DataQualityReportBuilderHandler.findAnyValue(
            component.path,
            handlerContext.dataContext.instanceExtractData,
            component,
          )
        : null;
      DataQualityReportBuilderHandler.collectFieldProblems(
        nonIterableComponent,
        dataValueObject,
        handlerContext.dataContext.instanceExtractData,
        report,
      );
      if (component instanceof MultiFieldComponent) {
        DataQualityReportBuilderHandler.collectCardinalityProblems(
          nonIterableComponent,
          (multiInstanceInfo as any as MultiInstanceObjectInfo).currentCount,
          report,
        );
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyList();
        const multiCount = (multiInstanceInfo as any as MultiInstanceObjectInfo).currentCount;
        for (let idx = 0; idx < multiCount; idx++) {
          const value = DataQualityReportBuilderHandler.extractPlainValue(dataValueObject[idx], component);
          valueTree[targetName]['values'].push(
            DataQualityReportBuilderHandler.getEmptyValueWrapper(value, isRequired, report, satisfiedBy),
          );
        }
      } else {
        const value = DataQualityReportBuilderHandler.extractPlainValue(dataValueObject, component);
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyValueWrapper(
          value,
          isRequired,
          report,
          satisfiedBy,
        );
      }
      ret = valueTree[targetName];
    }
    return ret;
  }

  /**
   * @param value          what this slot holds — goes into the value tree, so it
   *                       stays the value of the page being displayed.
   * @param satisfiedBy    what decides whether the requirement is met. Separate
   *                       from `value` because a required field inside a
   *                       multi-instance element is satisfied by *any* instance
   *                       holding a value, not only the one on screen.
   */

  /**
   * Constraint problems for one field, across every instance that holds a value.
   *
   * Walks the whole extract instance rather than the displayed page, for the
   * same reason `findAnyValue` does: which page is on screen must not change
   * whether the instance is reported as sound.
   */
  private static collectFieldProblems(
    component: FieldComponent,
    displayedNode: object,
    instanceExtractData: object,
    report: DataQualityReport,
  ): void {
    const nodes = DataQualityReportBuilderHandler.collectNodes(component.path, instanceExtractData);
    // Fall back to the displayed node when the path resolves to nothing, so a
    // field is still checked if the instance shape is unexpected.
    const targets = nodes.length > 0 ? nodes : displayedNode == null ? [] : [displayedNode];

    const seen = new Set<string>();
    for (const node of targets) {
      for (const p of FieldValueValidator.validateControlledNode(component, node, component.path)) {
        DataQualityReportBuilderHandler.addProblem(report, p, seen);
      }
      const value = DataQualityReportBuilderHandler.extractPlainValue(node, component);
      for (const p of FieldValueValidator.validate(component, value, component.path)) {
        DataQualityReportBuilderHandler.addProblem(report, p, seen);
      }
    }
  }

  /** `minItems` / `maxItems`, which nothing enforced outside the pager's buttons. */
  private static collectCardinalityProblems(component: any, currentCount: number, report: DataQualityReport): void {
    const multiInfo = component?.multiInfo;
    if (multiInfo == null) {
      return;
    }
    const path = component.path ?? [];
    const name = path.length > 0 ? path[path.length - 1] : component.name;
    const inputType = component.basicInfo?.inputType ?? 'element';

    if (multiInfo.minItems != null && currentCount < multiInfo.minItems) {
      report.problems.push(
        new ValidationProblem(
          path,
          name,
          inputType,
          ValidationCode.minItems,
          `Has ${currentCount} of a minimum ${multiInfo.minItems}.`,
          currentCount,
        ),
      );
    }
    if (multiInfo.maxItems != null && currentCount > multiInfo.maxItems) {
      report.problems.push(
        new ValidationProblem(
          path,
          name,
          inputType,
          ValidationCode.maxItems,
          `Has ${currentCount} of a maximum ${multiInfo.maxItems}.`,
          currentCount,
        ),
      );
    }
  }

  /** Deduplicate: the same violation on several instances is reported once per distinct code. */
  private static addProblem(report: DataQualityReport, problem: ValidationProblem, seen: Set<string>): void {
    const key = `${problem.path.join('/')}|${problem.code}|${String(problem.value)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    report.problems.push(problem);
  }

  /** Every node at `path`, branching into every array entry. Cursor-free, like findAnyValue. */
  private static collectNodes(path: string[], node: any, acc: object[] = []): object[] {
    if (node === null || node === undefined) {
      return acc;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        DataQualityReportBuilderHandler.collectNodes(path, entry, acc);
      }
      return acc;
    }
    if (path.length === 0) {
      acc.push(node);
      return acc;
    }
    const [head, ...rest] = path;
    if (!Object.hasOwn(node, head)) {
      return acc;
    }
    return DataQualityReportBuilderHandler.collectNodes(rest, node[head], acc);
  }

  private static getEmptyValueWrapper(
    value: object,
    isRequired: boolean,
    report: DataQualityReport,
    satisfiedBy: object = value,
  ) {
    const v = { value: value };
    if (isRequired) {
      v['required'] = true;
      report.requiredFieldValueCount++;
      if (satisfiedBy !== null) {
        report.nonNullRequiredFieldValueCount++;
      }
    }
    return v;
  }

  /**
   * The first value held at `path` by any instance, or null.
   *
   * Deliberately cursor-free. `handlerContext.getDataObjectNodeByPath` resolves
   * through each multi ancestor's `currentIndex`, so asking it whether a
   * required field is filled answers only for the page currently on screen —
   * the same instance reported valid or invalid depending on where the user had
   * paged to. This walks the extract instance directly and branches into every
   * array entry instead, so the answer depends on the data alone.
   *
   * Semantics: a requirement on a field inside a repeated element is met when
   * at least one instance carries a value. Requiring every instance to carry
   * one would need per-instance evaluation, which is a different and larger
   * change; see the roadmap.
   */
  private static findAnyValue(path: string[], node: any, component: SingleFieldComponent | MultiFieldComponent): any {
    if (node === null || node === undefined) {
      return null;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        const found = DataQualityReportBuilderHandler.findAnyValue(path, entry, component);
        if (found !== null) {
          return found;
        }
      }
      return null;
    }
    if (path.length === 0) {
      return DataQualityReportBuilderHandler.extractPlainValue(node, component);
    }
    const [head, ...rest] = path;
    if (!Object.hasOwn(node, head)) {
      return null;
    }
    return DataQualityReportBuilderHandler.findAnyValue(rest, node[head], component);
  }

  private static getEmptyList() {
    return { values: [] };
  }

  private static getEmptyObject() {
    return {};
  }

  /**
   * What this node holds, according to the model library's reading of it.
   *
   * The node's own type settles most of it — a literal by its value, a
   * controlled term by its label, a link by its IRI. Only one question needs
   * the template: `{@id, rdfs:label}` shows its label for a controlled term and
   * its IRI for a link, and the instance cannot tell those apart.
   */
  private static extractPlainValue(dataObject: object, component: SingleFieldComponent | MultiFieldComponent) {
    return InstanceValueNode.plainValue(dataObject, this.isIriValued(component));
  }

  /**
   * True when the field stores its value as a bare `@id` rather than `@value`.
   *
   * Links and external authority fields (ORCID, ROR, PFAS, PubMed, RRID, NIH
   * Grant, DOI) are written by `changeValue` as `{'@id': <iri>}` with no
   * `@value`. `DataObjectUtil.getEmptyValueWrapper` already makes the same
   * distinction using the same set, so this keeps the quality report in
   * agreement with the instance builder about which fields carry an IRI.
   *
   * Without it, every non-link IRI-valued field falls through to the
   * controlled-term branch below and is read from `rdfs:label`, which these
   * fields do not have — so a filled required field reports as empty and the
   * instance can never become valid.
   */
  private static isIriValued(component: SingleFieldComponent | MultiFieldComponent): boolean {
    const inputType = component.basicInfo.inputType;
    return inputType === InputType.link || EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType);
  }

}
