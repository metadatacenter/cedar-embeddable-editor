import * as _ from 'lodash-es';
import { InstanceNode, InstanceObject, isInstanceObject } from '../models/instance-node.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { AbstractFieldComponent } from '../models/field/abstract-field-component.model';
import { DataQualityReport } from '../models/data-quality-report.model';
import { ValidationCode, ValidationProblem } from '../validation/validation-problem.model';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { FieldValueValidator } from '../validation/field-value-validator';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { DataObjectUtil } from './data-object-util';
import type { CarriedForm } from './carried-answers';

interface Location {
  container: InstanceObject;
  field: AbstractFieldComponent | AbstractElementComponent;
  node: InstanceNode;
  index: number | null;
  /** Nearest first, for a template defect inside an optional occurrence. */
  ancestors: Array<{ entries: InstanceNode[]; index: number; minimum: number }>;
}

/** Resolve the report's address, including a terminal repeated field's occurrence. */
function locate(form: CarriedForm, problem: ValidationProblem): Location | null {
  let component: AbstractElementComponent = form.template;
  let container: InstanceNode = form.instance.dataContainer;
  let occurrence = 0;
  const ancestors: Location['ancestors'] = [];
  for (const [step, name] of problem.path.entries()) {
    if (!isInstanceObject(container)) return null;
    const child = component.getChildByName(name);
    if (!(child instanceof AbstractFieldComponent || child instanceof AbstractElementComponent)) return null;
    const held: InstanceNode | undefined = container.values[name];
    if (held === undefined) return null;
    if (step === problem.path.length - 1) {
      const index =
        Array.isArray(held) && occurrence < problem.occurrences.length ? problem.occurrences[occurrence] : null;
      const node = index !== null && Array.isArray(held) ? held[index] : held;
      return node === undefined ? null : { container, field: child, node, index, ancestors };
    }
    if (!(child instanceof AbstractElementComponent)) return null;
    if (child instanceof MultiElementComponent && Array.isArray(held)) {
      const index = problem.occurrences[occurrence++];
      ancestors.unshift({ entries: held, index, minimum: child.multiInfo.getSafeMinItems() });
      container = held[index];
    } else container = held;
    component = child;
    if (container === undefined) return null;
  }
  return null;
}

/**
 * Error permissions follow actual nodes, never path strings or array positions.
 * Fresh defaults and retained reader entries have separate evidence. Cloning a
 * default or moving an answer explicitly transfers that evidence to its new node.
 */
export class CarriedAnswerValidation {
  private readonly old = new WeakMap<object, Set<string>>();
  private readonly allowed = new WeakMap<object, Set<string>>();

  constructor(
    previous: CarriedForm,
    oldReport: DataQualityReport | null,
    next: CarriedForm,
    freshReport: DataQualityReport | null,
  ) {
    this.record(previous, oldReport, this.old);
    this.record(next, freshReport, this.allowed);
  }

  private record(form: CarriedForm, report: DataQualityReport | null, into: WeakMap<object, Set<string>>): void {
    for (const problem of report?.problems ?? []) {
      if (problem.severity !== 'error') continue;
      const node = locate(form, problem)?.node;
      if (node) {
        const codes = into.get(node) ?? new Set<string>();
        codes.add(problem.code);
        into.set(node, codes);
      }
    }
  }

  inherit(source: InstanceNode, target: InstanceNode, unchangedTree = false): void {
    const codes = this.old.get(source);
    if (codes) this.allowed.set(target, new Set([...(this.allowed.get(target) ?? []), ...codes]));
    if (unchangedTree && Array.isArray(source) && Array.isArray(target)) {
      source.forEach((child, index) => this.inherit(child, target[index], true));
    }
  }

  copyFresh(source: InstanceNode, target: InstanceNode, recursive = true): void {
    if (!source || !target) return;
    const codes = this.allowed.get(source);
    if (codes) this.allowed.set(target, new Set([...(this.allowed.get(target) ?? []), ...codes]));
    if (!recursive) return;
    if (Array.isArray(source) && Array.isArray(target)) {
      source.forEach((child, index) => this.copyFresh(child, target[index]));
    } else if (isInstanceObject(source) && isInstanceObject(target)) {
      Object.keys(source.values).forEach((key) => this.copyFresh(source.values[key], target.values[key]));
    }
  }

  unexpected(form: CarriedForm, report: DataQualityReport | null): ValidationProblem[] {
    return (report?.problems ?? []).filter((problem) => {
      if (problem.severity !== 'error') return false;
      const node = locate(form, problem)?.node;
      return !node || !this.allowed.get(node)?.has(problem.code);
    });
  }

  /** Repair one finding, then let the caller rebuild the report before resolving another address. */
  repair(form: CarriedForm, problem: ValidationProblem, builder: DataObjectBuilderHandler): boolean {
    const at = locate(form, problem);
    if (!at) return false;
    if (problem.code === ValidationCode.templateConstraint) {
      const removable = at.ancestors.find((ancestor) => ancestor.entries.length > ancestor.minimum);
      if (!removable) return false;
      removable.entries.splice(removable.index, 1);
      return true;
    }
    if (!(at.field instanceof AbstractFieldComponent)) return false;
    const field = at.field;
    const errors = (node: InstanceNode) =>
      [
        ...FieldValueValidator.validateNode(field, node, field.path),
        ...FieldValueValidator.validate(
          field,
          DataQualityReportBuilderHandler.extractPlainValue(node, field),
          field.path,
        ),
      ].filter((finding) => finding.severity === 'error');
    const replacement = (index: number | null): InstanceNode => {
      const fresh = builder.buildChild(field);
      const candidate = Array.isArray(fresh) ? fresh[index ?? 0] : fresh;
      return candidate && errors(candidate).length === 0 ? candidate : DataObjectUtil.getEmptyValueWrapper(field);
    };
    const held = at.container.values[field.name];
    if (Array.isArray(held)) {
      if (problem.code === ValidationCode.maxItems) {
        held.splice(field.multiInfo.maxItems ?? held.length);
        return true;
      }
      // Selections have no pager index in the public report. Validate each member,
      // replacing only the members responsible for this finding.
      const indexes =
        at.index === null
          ? held.flatMap((node, index) => (errors(node).some((error) => error.code === problem.code) ? [index] : []))
          : [at.index];
      let changed = false;
      for (const index of indexes.reverse()) {
        const next = replacement(index);
        if (
          DataQualityReportBuilderHandler.extractPlainValue(next, field) === null &&
          held.length > field.multiInfo.getSafeMinItems()
        ) {
          held.splice(index, 1);
          changed = true;
          continue;
        }
        if (!_.isEqual(held[index], next)) {
          held[index] = next;
          changed = true;
        }
      }
      return changed;
    }
    const next = replacement(null);
    if (_.isEqual(held, next)) return false;
    at.container.setValue(field.name, next);
    return true;
  }
}
