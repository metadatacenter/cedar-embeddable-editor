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
import { valueIsIri } from '../models/ext-auth-categories.model';
import { FieldValueValidator } from '../validation/field-value-validator';
import { ValidationCode, ValidationProblem } from '../validation/validation-problem.model';
import { InputType } from '../models/input-type.model';

export class DataQualityReportBuilderHandler {
  private dataObjectFull: object;
  private templateRepresentation: TemplateComponent;
  private report: DataQualityReport;

  buildReport(dataContext: DataContext, handlerContext: HandlerContext): DataQualityReport {
    this.report = new DataQualityReport();
    this.report.templateRepresentation = dataContext.templateRepresentation;
    // The envelope-free view, for the host page. Derived once here rather than
    // maintained as a second tree — see `DataContext.instanceExtractData`.
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
        DataQualityReportBuilderHandler.collectPresenceProblems(
          component as any,
          handlerContext.dataContext.instanceFullData,
          report,
        );
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
            handlerContext.dataContext.instanceFullData,
            component,
          )
        : null;
      DataQualityReportBuilderHandler.collectFieldProblems(
        nonIterableComponent,
        dataValueObject,
        handlerContext.dataContext.instanceFullData,
        report,
      );
      if (component instanceof MultiFieldComponent) {
        DataQualityReportBuilderHandler.collectPresenceProblems(
          nonIterableComponent,
          handlerContext.dataContext.instanceFullData,
          report,
        );
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
    instance: object,
    report: DataQualityReport,
  ): void {
    const nodes = DataQualityReportBuilderHandler.collectNodes(component.path, instance);
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

  /**
   * A multi child's array has to *be there*, whatever `minItems` says.
   *
   * `collectCardinalityProblems` below asks how many entries an array holds. This
   * asks the prior question, and they are genuinely different: CEDAR lists a multi
   * child in its parent's JSON Schema `required` array independently of any floor,
   * so the property is required to be present even when nothing constrains its
   * length. `[]` satisfies that. Absent does not, and neither does `null`.
   *
   * Without this, an element with no `minItems` and no array reported valid — the
   * cardinality check had nothing to compare against and returned early. The
   * canonical validator rejects it, and that was the last case where the two
   * disagreed. Verified by running `cedar-model-validation-library` itself rather
   * than by reading the schema: with the floor removed from
   * `multiple-element-items-template.json`, `[]` is valid while omitted gives
   * `object has missing required properties` and `null` gives `null found, array
   * expected`.
   *
   * Note it is not reachable from any template anyone has: across the corpus,
   * HuBMAP and the validator's own fixtures there are 321 multi children and every
   * one declares `minItems`. This closes the gap rather than fixing an outage.
   *
   * Attribute-value fields are exempt, and that is the model's distinction rather
   * than a special case here — they are the one child kind CEDAR leaves out of
   * `required`, because their names come from the user.
   */
  private static collectPresenceProblems(component: any, instance: object, report: DataQualityReport): void {
    const path: string[] = component?.path ?? [];
    if (path.length === 0) {
      return;
    }
    if (component.basicInfo?.inputType === InputType.attributeValue) {
      return;
    }

    const name = path[path.length - 1];
    const parents = DataQualityReportBuilderHandler.collectNodes(path.slice(0, -1), instance);
    const inputType = component.basicInfo?.inputType ?? 'element';

    for (const parent of parents) {
      const present = Object.hasOwn(parent, name);
      const value = present ? parent[name] : undefined;
      // An array is the only shape that satisfies this, which is what the gate
      // asks for — `[]` included. Worth testing the shape rather than just
      // presence: an injected `null` does not survive as `null`. It is read into
      // `{}`, an object where the template declares an array, which the canonical
      // validator rejects for the same reason it rejects `null`.
      if (Array.isArray(value)) {
        continue;
      }
      report.problems.push(
        new ValidationProblem(
          path,
          name,
          inputType,
          ValidationCode.missingProperty,
          present
            ? `Holds ${value === null ? 'null' : typeof value} where the template declares an array.`
            : 'Is absent, and the template requires the property.',
          value ?? null,
        ),
      );
      // One complaint per component is enough; a second parent holding the same
      // shape says nothing new.
      return;
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

  private static isIriValued(component: SingleFieldComponent | MultiFieldComponent): boolean {
    return valueIsIri(component.basicInfo.inputType);
  }
}
