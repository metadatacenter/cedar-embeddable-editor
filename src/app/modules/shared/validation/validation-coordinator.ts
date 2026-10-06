import { FieldComponent } from '../models/component/field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InstanceNode, isInstanceObject } from '../models/instance-node.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { HandlerContext } from '../util/handler-context';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { ValidationCode, ValidationProblem } from './validation-problem.model';

/** An edit which cannot yet be represented as a stored value. Never part of exported metadata. */
export interface FieldDraft {
  code: string;
  message: string;
  value: unknown;
  state: unknown;
}

/**
 * One validation boundary for loads, edits and structural transitions.
 * Drafts belong to the actual occurrence node, not a cursor or array index: moving an
 * occurrence moves its draft; removing it removes its problems from the next report.
 * A newly loaded document gets a new coordinator. Weak keys retain no deleted branches.
 */
export class ValidationCoordinator {
  private readonly builder = new DataQualityReportBuilderHandler();
  private readonly drafts = new WeakMap<object, FieldDraft>();

  constructor(private readonly context: HandlerContext) {}

  private currentNode(component: FieldComponent): InstanceNode | null {
    const held = this.context.getDataObjectNodeByPath(component.path);
    if (component instanceof MultiFieldComponent && component.isMultiPage() && Array.isArray(held)) {
      const index =
        this.context.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)?.currentIndex ?? -1;
      return held[index] ?? null;
    }
    return held;
  }

  setDraft(component: FieldComponent, draft: FieldDraft | null): void {
    const node = this.currentNode(component);
    if (node === null || typeof node !== 'object') return;
    if (draft === null) this.drafts.delete(node);
    else this.drafts.set(node, draft);
  }

  draftFor(component: FieldComponent): FieldDraft | null {
    const node = this.currentNode(component);
    return node !== null && typeof node === 'object' ? (this.drafts.get(node) ?? null) : null;
  }

  /** Copy unfinished edits with a copied branch; each copy then owns its own draft. */
  copyDrafts(source: InstanceNode | null, target: InstanceNode | null): void {
    if (source === null || target === null || typeof source !== 'object' || typeof target !== 'object') return;
    const draft = this.drafts.get(source);
    if (draft) this.drafts.set(target, structuredClone(draft));
    if (Array.isArray(source) && Array.isArray(target)) {
      source.forEach((node, index) => this.copyDrafts(node, target[index] ?? null));
    } else if (isInstanceObject(source) && isInstanceObject(target)) {
      for (const key of Object.keys(source.values)) this.copyDrafts(source.values[key], target.values[key] ?? null);
    }
  }

  problemsFor(component: FieldComponent, node: InstanceNode): ValidationProblem[] {
    const draft = typeof node === 'object' && node !== null ? this.drafts.get(node) : undefined;
    return draft
      ? [
          new ValidationProblem(
            component.path,
            component.name,
            component.basicInfo.inputType,
            draft.code,
            draft.message,
            draft.value,
          ),
        ]
      : [];
  }

  validate(): void {
    const data = this.context.dataContext;
    const report = this.builder.buildReport(data, this.context);
    const template = data.templateRepresentation;
    const expected = template instanceof CedarTemplate ? template.isBasedOn : null;
    const actual = data.instanceFullData?.schema_isBasedOn?.getValue();
    if (expected && actual && expected !== actual) {
      report.problems.push(
        new ValidationProblem(
          [],
          '',
          null,
          ValidationCode.templateMismatch,
          'The instance belongs to a different template. Load it with its original template.',
          actual,
        ),
      );
    }
    report.computeValidity();
    // Before a document exists, an empty report must not advertise a valid instance.
    if (template === null || data.instanceFullData === null) report.isValid = false;
    data.dataQualityReport = report;
  }
}
