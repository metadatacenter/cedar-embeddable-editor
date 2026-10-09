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
import { HandlerContext } from '../util/handler-context';
import { InstanceValueNode } from '../util/instance-value-node';
import { valueIsIri } from '../models/ext-auth-categories.model';
import { FieldValueValidator } from '../validation/field-value-validator';
import { ValidationCode, ValidationProblem } from '../validation/validation-problem.model';
import { InputType } from '../models/input-type.model';
import { BasicInfo } from '../models/info/basic-info.model';
import { MultiInfo } from '../models/info/multi-info.model';
import { InstanceNode, childOf, isInstanceArray } from '../models/instance-node.model';
import { InstanceDataContainer, InstanceDataEmptyAtom, InstanceDataEmptyNode } from 'cedar-model-typescript-library';

/**
 * What the cardinality check reads off a component.
 *
 * `CedarComponent` declares neither `basicInfo` nor `multiInfo` — the first
 * belongs to fields, the second to multi-instance components — and the check is
 * called with elements and fields alike. It already optional-chains both and
 * falls back, so the shape it actually requires is the common interface plus
 * those two as optional. Written down rather than left as `any`, which said
 * nothing and permitted everything.
 */
type InspectedComponent = CedarComponent & {
  basicInfo?: BasicInfo;
  multiInfo?: MultiInfo;
};

/**
 * A node the walk has reached, and where it sits.
 *
 * `occurrences` holds the entry taken at each repeating component above the node,
 * outermost first, which is the shape `HandlerContext.getDataObjectNodeAt` reads.
 * A component path alone names one node per entry of every repeating ancestor, so
 * a problem located by its path could not say which entry held the bad value, and
 * a host could not take the user to it. `node` is null where the instance holds
 * nothing, so the components below are still checked: an absent element is
 * written out empty, and an empty element can still be too short a list.
 */
interface Located {
  node: InstanceNode | null;
  occurrences: number[];
}

/**
 * Builds the data quality report from a template and the instance under it.
 *
 * Stateless, for the reason given on `DataObjectBuilderHandler`: `dataObjectFull`
 * and `templateRepresentation` were declared and never read, and `report` is a
 * local that one method builds and returns — it reaches the recursion as an
 * argument, which is why it never needed to be a field.
 *
 * The walk follows the instance, entry by entry, rather than the cursor each pager
 * moves. Which entry is on screen must not change what the report says. The value
 * checks already walked the whole instance; the cardinality checks read the count
 * of the entry on screen, so a repeating field inside a repeating element was
 * judged by whichever entry of the element the user had paged to.
 */
export class DataQualityReportBuilderHandler {
  buildReport(dataContext: DataContext, handlerContext: HandlerContext): DataQualityReport {
    const report = new DataQualityReport();

    if (dataContext.templateRepresentation != null && dataContext.templateInput != null) {
      const root: Located = { node: dataContext.instanceFullData?.dataContainer ?? null, occurrences: [] };
      for (const child of dataContext.templateRepresentation.children) {
        DataQualityReportBuilderHandler.buildRecursively(child, [root], report, handlerContext);
      }
    }
    report.computeValidity();
    return report;
  }

  /**
   * Check one component in every container that holds it.
   *
   * `parents` are the containers the component's property sits in: one per entry
   * of each repeating element above it, so the same declaration is checked once
   * for every place the instance can hold it.
   */
  private static buildRecursively(
    component: CedarComponent,
    parents: Located[],
    report: DataQualityReport,
    handlerContext: HandlerContext,
  ): void {
    if (component instanceof MultiElementComponent) {
      const entries: Located[] = [];
      for (const parent of parents) {
        const held = DataQualityReportBuilderHandler.entriesOf(parent.node, component.name);
        DataQualityReportBuilderHandler.collectCardinalityProblems(component, held.length, parent.occurrences, report);
        held.forEach((node, index) => {
          const occurrences = [...parent.occurrences, index];
          DataQualityReportBuilderHandler.collectElementShapeProblem(component, node, occurrences, report);
          entries.push({ node, occurrences });
        });
      }
      // An element nobody has added has no fields to count or check, which is what
      // a host reading `requiredFieldValueCount` has always been told.
      if (entries.length > 0) {
        for (const childComponent of (component as ElementComponent).children) {
          DataQualityReportBuilderHandler.buildRecursively(childComponent, entries, report, handlerContext);
        }
      }
    } else if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
      const containers = parents.map((parent) => ({
        node: childOf(parent.node, component.name),
        occurrences: parent.occurrences,
      }));
      for (const container of containers)
        DataQualityReportBuilderHandler.collectElementShapeProblem(
          component,
          container.node,
          container.occurrences,
          report,
        );
      for (const childComponent of (component as ElementComponent).children) {
        DataQualityReportBuilderHandler.buildRecursively(childComponent, containers, report, handlerContext);
      }
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const configuration = FieldValueValidator.validateConfiguration(nonIterableComponent);
      for (const parent of parents)
        report.problems.push(...configuration.map((problem) => problem.at(parent.occurrences)));
      DataQualityReportBuilderHandler.collectFieldProblems(nonIterableComponent, parents, handlerContext, report);
      if (component instanceof MultiFieldComponent) {
        for (const parent of parents) {
          DataQualityReportBuilderHandler.collectCardinalityProblems(
            nonIterableComponent,
            DataQualityReportBuilderHandler.entriesOf(parent.node, component.name).length,
            parent.occurrences,
            report,
          );
        }
      }
      DataQualityReportBuilderHandler.countRequirement(component, parents, report);
    }
  }

  private static collectElementShapeProblem(
    component: CedarComponent,
    node: InstanceNode | null,
    occurrences: number[],
    report: DataQualityReport,
  ): void {
    if (
      node === null ||
      node instanceof InstanceDataContainer ||
      node instanceof InstanceDataEmptyNode ||
      (node instanceof InstanceDataEmptyAtom && !node.hasDiscardedContent())
    )
      return;
    report.problems.push(
      new ValidationProblem(
        component.path,
        component.name,
        'element',
        ValidationCode.valueShape,
        'This element must contain fields, not a field value or a list in place of one element.',
        null,
        occurrences,
      ),
    );
  }

  /** One declaration count, but an answer is required in every existing containing element. */
  private static countRequirement(
    component: SingleFieldComponent | MultiFieldComponent,
    parents: Located[],
    report: DataQualityReport,
  ): void {
    if (!component.valueInfo.requiredValue) return;
    report.requiredFieldValueCount++;
    let complete = true;
    for (const parent of parents) {
      const held = childOf(parent.node, component.name);
      const entries = isInstanceArray(held) ? held : [held];
      if (entries.some((entry) => DataQualityReportBuilderHandler.extractPlainValue(entry, component) !== null))
        continue;
      complete = false;
      report.problems.push(
        new ValidationProblem(
          component.path,
          component.name,
          component.basicInfo.inputType,
          ValidationCode.required,
          'A required value is missing.',
          null,
          parent.occurrences,
        ),
      );
    }
    if (complete) report.nonNullRequiredFieldValueCount++;
  }

  /**
   * Constraint problems for one field, in every entry that holds a value.
   *
   * Walks the whole instance rather than the displayed page: which page is on screen must not change
   * whether the instance is reported as sound. Each problem carries the entry it
   * was found in, so the same bad value in two entries is two problems a host can
   * take the user to, rather than one it cannot.
   */
  private static collectFieldProblems(
    component: FieldComponent,
    parents: Located[],
    handlerContext: HandlerContext,
    report: DataQualityReport,
  ): void {
    const targets: Array<{ node: InstanceNode; occurrences: number[] }> = [];
    // A list the form pages through is one value per entry. A checkbox group or a
    // multiple-choice list is one value that happens to be a list, and its entries
    // are selections rather than places a host could send the user.
    const paged = component instanceof MultiFieldComponent && component.isMultiPage();
    for (const parent of parents) {
      const held = childOf(parent.node, component.name);
      if (isInstanceArray(held)) {
        if (component instanceof SingleFieldComponent) {
          report.problems.push(
            new ValidationProblem(
              component.path,
              component.name,
              component.basicInfo.inputType,
              ValidationCode.valueShape,
              'This field accepts one value, not a list.',
              null,
              parent.occurrences,
            ),
          );
        }
        held.forEach((node, index) => {
          if (node !== null && node !== undefined) {
            targets.push({ node, occurrences: paged ? [...parent.occurrences, index] : parent.occurrences });
          }
        });
      } else if (held !== null) {
        targets.push({ node: held, occurrences: parent.occurrences });
      }
    }
    const seen = new Set<string>();
    for (const target of targets) {
      const drafts = handlerContext.validation.problemsFor(component, target.node);
      const stored = FieldValueValidator.validateNode(component, target.node, component.path).filter(
        (problem) => !drafts.some((draft) => draft.code === problem.code),
      );
      for (const p of [...stored, ...drafts]) {
        DataQualityReportBuilderHandler.addProblem(report, p.at(target.occurrences), seen);
      }
      const value = DataQualityReportBuilderHandler.extractPlainValue(target.node, component);
      for (const p of FieldValueValidator.validate(component, value, component.path)) {
        DataQualityReportBuilderHandler.addProblem(report, p.at(target.occurrences), seen);
      }
    }
  }

  /**
   * `minItems` / `maxItems`, which nothing enforced outside the pager's buttons.
   *
   * Asked once per container holding the list, with the count that container
   * holds, and located at that container.
   */
  private static collectCardinalityProblems(
    component: InspectedComponent,
    currentCount: number,
    occurrences: number[],
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
          occurrences,
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
          occurrences,
        ),
      );
    }
  }

  /** Deduplicate: the same violation of one value is reported once. */
  private static addProblem(report: DataQualityReport, problem: ValidationProblem, seen: Set<string>): void {
    const key = JSON.stringify([problem.path, problem.occurrences, problem.code, problem.value]);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    report.problems.push(problem);
  }

  /**
   * The entries of a list a container holds, in order.
   *
   * No entries where the container holds nothing, and one where it holds a single
   * node in place of a list. CEE writes either out as a list, so the count is the
   * one the written instance will have.
   */
  private static entriesOf(container: InstanceNode | null, name: string): InstanceNode[] {
    const held = childOf(container, name);
    if (held === null) {
      return [];
    }
    return isInstanceArray(held) ? held : [held];
  }

  /**
   * What this node holds, according to the model library's reading of it.
   *
   * The node's own type settles most of it — a literal by its value, a
   * controlled term by its label, a link by its IRI. Only one question needs
   * the template: `{@id, rdfs:label}` shows its label for a controlled term and
   * its IRI for a link, and the instance cannot tell those apart.
   */
  static extractPlainValue(dataObject: InstanceNode | null, component: FieldComponent) {
    return InstanceValueNode.plainValue(dataObject, this.isIriValued(component));
  }

  private static isIriValued(component: FieldComponent): boolean {
    return component.basicInfo.inputType !== null && valueIsIri(component.basicInfo.inputType as InputType);
  }
}
