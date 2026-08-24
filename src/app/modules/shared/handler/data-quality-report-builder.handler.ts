import { DataQualityReport } from '../models/data-quality-report.model';
import { DataContext } from '../util/data-context';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../util/handler-context';
import { InstanceValueNode } from '../util/instance-value-node';
import { valueIsIri } from '../models/ext-auth-categories.model';
import { FieldValueValidator } from '../validation/field-value-validator';
import { ValidationCode, ValidationProblem } from '../validation/validation-problem.model';
import { InputType } from '../models/input-type.model';
import { BasicInfo } from '../models/info/basic-info.model';
import { MultiInfo } from '../models/info/multi-info.model';
import { InstanceNode, isInstanceObject } from '../models/instance-node.model';

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
 * Builds the data quality report from a template and the instance under it.
 *
 * Stateless, for the reason given on `DataObjectBuilderHandler`: `dataObjectFull`
 * and `templateRepresentation` were declared and never read, and `report` is a
 * local that one method builds and returns — it reaches the recursion as an
 * argument, which is why it never needed to be a field.
 */
export class DataQualityReportBuilderHandler {
  buildReport(dataContext: DataContext, handlerContext: HandlerContext): DataQualityReport {
    const report = new DataQualityReport();

    if (dataContext.templateRepresentation != null && dataContext.templateInput != null) {
      const rootState = handlerContext.multiInstanceObjectService.rootState;
      for (const child of dataContext.templateRepresentation.children) {
        DataQualityReportBuilderHandler.buildRecursively(child, report, rootState.getState(child.name), handlerContext);
      }
    }
    report.computeValidity();
    return report;
  }

  private static buildRecursively(
    component: CedarComponent,
    report: DataQualityReport,
    multiInstanceState: MultiInstanceObjectInfo | null,
    handlerContext: HandlerContext,
  ): void {
    if (
      component instanceof SingleElementComponent ||
      component instanceof MultiElementComponent ||
      component instanceof CedarTemplate
    ) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      if (component instanceof MultiElementComponent) {
        const multiCount = multiInstanceState?.currentCount ?? 0;
        DataQualityReportBuilderHandler.collectPresenceProblems(
          component,
          handlerContext.dataContext.instanceFullData?.dataContainer ?? null,
          report,
        );
        DataQualityReportBuilderHandler.collectCardinalityProblems(component, multiCount, report);
        if (multiCount > 0) {
          const currentIndex = multiInstanceState?.currentIndex ?? -1;
          const childStates = currentIndex >= 0 ? multiInstanceState?.occurrences[currentIndex] : undefined;
          for (const childComponent of iterableComponent.children) {
            DataQualityReportBuilderHandler.buildRecursively(
              childComponent,
              report,
              childStates?.getState(childComponent.name) ?? null,
              handlerContext,
            );
          }
        }
      } else {
        const childStates = multiInstanceState?.occurrences[0];
        for (const childComponent of iterableComponent.children) {
          DataQualityReportBuilderHandler.buildRecursively(
            childComponent,
            report,
            childStates?.getState(childComponent.name) ?? null,
            handlerContext,
          );
        }
      }
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const dataValueObject: InstanceNode | null = handlerContext.getDataObjectNodeByPath(component.path);
      DataQualityReportBuilderHandler.collectFieldProblems(
        nonIterableComponent,
        dataValueObject,
        handlerContext.dataContext.instanceFullData?.dataContainer ?? null,
        report,
      );
      if (component instanceof MultiFieldComponent) {
        DataQualityReportBuilderHandler.collectPresenceProblems(
          nonIterableComponent,
          handlerContext.dataContext.instanceFullData?.dataContainer ?? null,
          report,
        );
        DataQualityReportBuilderHandler.collectCardinalityProblems(
          nonIterableComponent,
          multiInstanceState?.currentCount ?? 0,
          report,
        );
      }
      DataQualityReportBuilderHandler.countRequirement(component, report, handlerContext);
    }
  }

  /**
   * Whether this field's requirement is declared, whether it is met, and the
   * host-visible problem when it is not.
   *
   * One count per required field the template declares, whatever its
   * cardinality. A multi field used to contribute one count per occurrence,
   * which made the pair mean two different things in one report: three
   * occurrences of one required field read as `3` while a required field inside
   * an element repeated three times read as `1`. Neither number was per
   * occurrence, because a single `satisfiedBy` answered for all of them — so
   * filling one of three occurrences reported "3 of 3 filled". The verdict was
   * right and the number was not, and a host has nothing to label but the
   * number.
   *
   * Whether a requirement is satisfied is asked of the whole instance, not of
   * the page currently on screen. See `findAnyValue`.
   */
  private static countRequirement(
    component: SingleFieldComponent | MultiFieldComponent,
    report: DataQualityReport,
    handlerContext: HandlerContext,
  ): void {
    if (!component.valueInfo.requiredValue) {
      return;
    }
    report.requiredFieldValueCount++;
    const satisfiedBy = DataQualityReportBuilderHandler.findAnyValue(
      component.path,
      handlerContext.dataContext.instanceFullData?.dataContainer ?? null,
      component,
    );
    if (satisfiedBy !== null) {
      report.nonNullRequiredFieldValueCount++;
      return;
    }
    const path = component.path ?? [];
    report.problems.push(
      new ValidationProblem(
        path,
        path.length > 0 ? path[path.length - 1] : component.name,
        component.basicInfo.inputType,
        ValidationCode.required,
        'A required value is missing.',
        null,
      ),
    );
  }

  /**
   * Constraint problems for one field, across every instance that holds a value.
   *
   * Walks the whole extract instance rather than the displayed page, for the
   * same reason `findAnyValue` does: which page is on screen must not change
   * whether the instance is reported as sound.
   */
  private static collectFieldProblems(
    component: FieldComponent,
    displayedNode: InstanceNode | null,
    instance: InstanceNode | null,
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
    instance: InstanceNode | null,
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
      const present = isInstanceObject(parent) && parent.hasValue(name);
      const value = present ? parent.values[name] : undefined;
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
  private static collectNodes(path: string[], node: InstanceNode | null, acc: InstanceNode[] = []): InstanceNode[] {
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
    if (!isInstanceObject(node) || !node.hasValue(head)) {
      return acc;
    }
    return DataQualityReportBuilderHandler.collectNodes(rest, node.values[head] ?? null, acc);
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
    node: InstanceNode | null,
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
    if (!isInstanceObject(node) || !node.hasValue(head)) {
      return null;
    }
    return DataQualityReportBuilderHandler.findAnyValue(rest, node.values[head] ?? null, component);
  }

  /**
   * What this node holds, according to the model library's reading of it.
   *
   * The node's own type settles most of it — a literal by its value, a
   * controlled term by its label, a link by its IRI. Only one question needs
   * the template: `{@id, rdfs:label}` shows its label for a controlled term and
   * its IRI for a link, and the instance cannot tell those apart.
   */
  private static extractPlainValue(
    dataObject: InstanceNode | null,
    component: SingleFieldComponent | MultiFieldComponent,
  ) {
    return InstanceValueNode.plainValue(dataObject, this.isIriValued(component));
  }

  private static isIriValued(component: SingleFieldComponent | MultiFieldComponent): boolean {
    return component.basicInfo.inputType !== null && valueIsIri(component.basicInfo.inputType as InputType);
  }
}
