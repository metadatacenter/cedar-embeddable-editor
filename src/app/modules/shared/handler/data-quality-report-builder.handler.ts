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
import { BasicInfo } from '../models/info/basic-info.model';
import { MultiInfo } from '../models/info/multi-info.model';
import { InstanceNode, isInstanceArray, isInstanceObject } from '../models/instance-node.model';

/**
 * What the two problem collectors read off a component.
 *
 * `CedarComponent` declares neither `basicInfo` nor `multiInfo` — the first
 * belongs to fields, the second to multi-instance components — and both
 * collectors are called with elements, templates and fields alike. They already
 * optional-chain both and fall back, so the shape they actually require is the
 * common interface plus those two as optional. Written down rather than left as
 * `any`, which said nothing and permitted everything.
 */
type InspectedComponent = CedarComponent & {
  basicInfo?: BasicInfo;
  multiInfo?: MultiInfo;
};

/**
 * Read a node of the multi-instance tree as the object info it holds.
 *
 * `MultiInstanceInfo` and `MultiInstanceObjectInfo` are unrelated classes: the
 * first is a bag keyed by component name, the second is what those keys hold. The
 * recursion below walks from one into the other, so at the points that read
 * `currentCount` the value is an object info even though the parameter is typed as
 * the bag. TypeScript cannot see that, so the conversion has to be asserted.
 *
 * It was asserted five separate times as `as any as`. Named once instead, and
 * through `unknown` rather than `any`, which is the same assertion without
 * disabling every other check on the expression. The muddle it papers over is
 * real and worth fixing properly one day: the parameter type is honest at the
 * root call and wrong at every recursive one.
 */
/*
 * The two multi-instance info types are conflated, and these two bridges are where
 * it shows. `MultiInstanceInfo` is a map from component name to
 * `MultiInstanceObjectInfo`; `MultiInstanceObjectInfo` is a node with a count, an
 * index and a list of child maps. The recursion below alternates between them —
 * the root is a map, every child is a node — while declaring one type throughout.
 *
 * `asObjectInfo` predates this work and papered over it while the parameter was
 * effectively untyped. `asInfo` is its inverse, needed now that `getChildByName`
 * returns its real type. Neither is a fix: straightening out the two is a model
 * change of its own, recorded on the roadmap rather than smuggled in here.
 */
const asObjectInfo = (info: MultiInstanceInfo): MultiInstanceObjectInfo => info as unknown as MultiInstanceObjectInfo;

/**
 * A child of the info tree, by component name.
 *
 * Deliberately a property lookup and not `MultiInstanceInfo.getChildByName`, even
 * though that accessor exists and is typed. What actually arrives here is sometimes
 * a `MultiInstanceObjectInfo`, which has no such method — swapping the lookup for
 * the accessor threw `getChildByName is not a function` across 216 domain tests.
 * The declared parameter type is the lie; the lookup is what works on both.
 */
const childInfo = (info: MultiInstanceInfo, name: string): MultiInstanceInfo =>
  (info as unknown as Record<string, MultiInstanceInfo>)[name];

/**
 * The report's value tree, which is not an instance tree and never was.
 *
 * Three shapes, mirroring the template rather than the document: a container keyed
 * by child component name, a list of occurrences under `values`, and a leaf holding
 * what was found and whether it was required. It was typed `object` throughout, so
 * `valueTree[name]['values'].push(...)` type-checked against nothing.
 */
export interface ReportValue {
  value: unknown;
  required?: true;
}

export interface ReportList {
  values: ReportNode[];
}

export interface ReportContainer {
  [componentName: string]: ReportNode;
}

export type ReportNode = ReportValue | ReportList | ReportContainer;

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

    const valueTree: ReportContainer = {};

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
    valueTree: ReportContainer,
    multiInstanceInfo: MultiInstanceInfo,
    handlerContext: HandlerContext,
  ): void {
    if (
      component instanceof SingleElementComponent ||
      component instanceof MultiElementComponent ||
      component instanceof CedarTemplate
    ) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      const targetName = iterableComponent.name;
      if (component instanceof MultiElementComponent) {
        //const multiElement: MultiElementComponent = component as MultiElementComponent;
        const occurrences = DataQualityReportBuilderHandler.getEmptyList();
        valueTree[targetName] = occurrences;
        const multiCount = asObjectInfo(multiInstanceInfo).currentCount;
        DataQualityReportBuilderHandler.collectPresenceProblems(
          component,
          handlerContext.dataContext.instanceFullData,
          report,
        );
        DataQualityReportBuilderHandler.collectCardinalityProblems(component, multiCount, report);
        if (multiCount > 0) {
          const dummyTargetObject: ReportContainer = DataQualityReportBuilderHandler.getEmptyObject();
          const currentIndex = asObjectInfo(multiInstanceInfo).currentIndex;
          for (const childComponent of iterableComponent.children) {
            DataQualityReportBuilderHandler.buildRecursively(
              childComponent,
              report,
              dummyTargetObject,
              childInfo(asObjectInfo(multiInstanceInfo).children[currentIndex], childComponent.name),
              handlerContext,
            );
          }
          const multiCount = asObjectInfo(multiInstanceInfo).currentCount;
          for (let idx = 0; idx < multiCount; idx++) {
            const clone = _.cloneDeep(dummyTargetObject);
            occurrences.values.push(clone);
          }
        }
      } else {
        valueTree[targetName] = DataQualityReportBuilderHandler.getEmptyObject();
        for (const childComponent of iterableComponent.children) {
          let nextMultiInstanceInfo = childInfo(multiInstanceInfo, childComponent.name);
          if (nextMultiInstanceInfo == undefined) {
            nextMultiInstanceInfo = childInfo(asObjectInfo(multiInstanceInfo).children[0], childComponent.name);
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
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      let isRequired = false;
      if (component.valueInfo.requiredValue) {
        isRequired = true;
      }
      const dataValueObject: InstanceNode = handlerContext.getDataObjectNodeByPath(component.path);
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
          asObjectInfo(multiInstanceInfo).currentCount,
          report,
        );
        const occurrences = DataQualityReportBuilderHandler.getEmptyList();
        valueTree[targetName] = occurrences;
        const multiCount = asObjectInfo(multiInstanceInfo).currentCount;
        for (let idx = 0; idx < multiCount; idx++) {
          const occurrence = isInstanceArray(dataValueObject) ? dataValueObject[idx] : null;
          const value = DataQualityReportBuilderHandler.extractPlainValue(occurrence, component);
          occurrences.values.push(
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
    }
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
    displayedNode: InstanceNode,
    instance: InstanceNode,
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
  private static collectPresenceProblems(
    component: InspectedComponent,
    instance: InstanceNode,
    report: DataQualityReport,
  ): void {
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
      const present = isInstanceObject(parent) && Object.hasOwn(parent, name);
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
  private static collectCardinalityProblems(
    component: InspectedComponent,
    currentCount: number,
    report: DataQualityReport,
  ): void {
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
  private static collectNodes(path: string[], node: InstanceNode, acc: InstanceNode[] = []): InstanceNode[] {
    if (node === null || node === undefined) {
      return acc;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        DataQualityReportBuilderHandler.collectNodes(path, entry, acc);
      }
      return acc;
    }
    // Narrowed rather than assumed: `unknown` is what an instance node really is,
    // and a primitive leaf reaches here on a path that expects more depth. It was
    // pushed into `object[]` regardless while this was `any`.
    if (typeof node !== 'object') {
      return acc;
    }
    if (path.length === 0) {
      acc.push(node);
      return acc;
    }
    const [head, ...rest] = path;
    if (!isInstanceObject(node) || !Object.hasOwn(node, head)) {
      return acc;
    }
    return DataQualityReportBuilderHandler.collectNodes(rest, node[head], acc);
  }

  private static getEmptyValueWrapper(
    value: unknown,
    isRequired: boolean,
    report: DataQualityReport,
    satisfiedBy: unknown = value,
  ): ReportValue {
    const v: ReportValue = { value: value };
    if (isRequired) {
      v.required = true;
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
  private static findAnyValue(
    path: string[],
    node: InstanceNode,
    component: SingleFieldComponent | MultiFieldComponent,
  ): unknown {
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
    if (typeof node !== 'object') {
      return null;
    }
    if (path.length === 0) {
      return DataQualityReportBuilderHandler.extractPlainValue(node, component);
    }
    const [head, ...rest] = path;
    if (!isInstanceObject(node) || !Object.hasOwn(node, head)) {
      return null;
    }
    return DataQualityReportBuilderHandler.findAnyValue(rest, node[head], component);
  }

  private static getEmptyList(): ReportList {
    return { values: [] };
  }

  private static getEmptyObject(): ReportContainer {
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
  private static extractPlainValue(dataObject: InstanceNode, component: SingleFieldComponent | MultiFieldComponent) {
    return InstanceValueNode.plainValue(dataObject, this.isIriValued(component));
  }

  private static isIriValued(component: SingleFieldComponent | MultiFieldComponent): boolean {
    return valueIsIri(component.basicInfo.inputType);
  }
}
