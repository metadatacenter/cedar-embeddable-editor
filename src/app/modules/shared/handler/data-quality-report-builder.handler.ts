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
import { InstanceNode, childOf, isInstanceArray, isInstanceObject } from '../models/instance-node.model';

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
        held.forEach((node, index) => entries.push({ node, occurrences: [...parent.occurrences, index] }));
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
      for (const childComponent of (component as ElementComponent).children) {
        DataQualityReportBuilderHandler.buildRecursively(childComponent, containers, report, handlerContext);
      }
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      DataQualityReportBuilderHandler.collectFieldProblems(
        nonIterableComponent,
        parents,
        handlerContext.getDataObjectNodeByPath(component.path),
        report,
      );
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
   * the page currently on screen. See `findAnyValue`. The problem therefore names
   * no entry: it belongs to the declaration, and any entry would satisfy it.
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
   * Constraint problems for one field, in every entry that holds a value.
   *
   * Walks the whole extract instance rather than the displayed page, for the
   * same reason `findAnyValue` does: which page is on screen must not change
   * whether the instance is reported as sound. Each problem carries the entry it
   * was found in, so the same bad value in two entries is two problems a host can
   * take the user to, rather than one it cannot.
   */
  private static collectFieldProblems(
    component: FieldComponent,
    parents: Located[],
    displayedNode: InstanceNode | null,
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
        held.forEach((node, index) => {
          if (node !== null && node !== undefined) {
            targets.push({ node, occurrences: paged ? [...parent.occurrences, index] : parent.occurrences });
          }
        });
      } else if (held !== null) {
        targets.push({ node: held, occurrences: parent.occurrences });
      }
    }
    // Fall back to the displayed node when the instance holds nothing at the path,
    // so a field is still checked if the instance shape is unexpected.
    if (targets.length === 0 && displayedNode != null) {
      targets.push({ node: displayedNode, occurrences: [] });
    }

    const seen = new Set<string>();
    for (const target of targets) {
      for (const p of FieldValueValidator.validateControlledNode(component, target.node, component.path)) {
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
    const key = `${problem.path.join('/')}|${problem.occurrences.join('/')}|${problem.code}|${String(problem.value)}`;
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
