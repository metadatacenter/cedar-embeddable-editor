import { SemanticChecks } from './semantic-checks';
import { DataQualityReport } from '../models/data-quality-report.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { InputType } from '../models/input-type.model';
import { authorityDescriptorFor } from '../models/authority/authority-descriptor.model';
import { validAbsoluteFieldIri } from './absolute-iri';
import { InstanceValidator, RegexChecks } from 'cedar-model-typescript-library';
import { FieldComponent } from '../models/component/field-component.model';
import { InstanceNode, isInstanceObject, childOf } from '../models/instance-node.model';
import type { CeeRecoveryDraft } from '../../../cee-public-api';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { HandlerContext } from '../util/handler-context';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { ValidationCode, ValidationProblem } from './validation-problem.model';
import { InstanceDeserializer } from '../util/instance-deserializer';

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

  private disposed = false;
  private terminologyBaseUrl: string | null = null;
  private bridgeBaseUrl: string | null = null;
  private readonly semantic = new SemanticChecks(() => {
    if (this.disposed) return;
    this.validate();
    this.context.validationChanged();
  });

  configureSemantic(terminologyBaseUrl: string | null, bridgeBaseUrl: string | null): void {
    if (this.terminologyBaseUrl === terminologyBaseUrl && this.bridgeBaseUrl === bridgeBaseUrl) return;
    this.terminologyBaseUrl = terminologyBaseUrl;
    this.bridgeBaseUrl = bridgeBaseUrl;
    this.validate();
  }

  collectSemantic(
    component: FieldComponent,
    node: InstanceNode,
    occurrences: number[],
    report: DataQualityReport,
  ): void {
    const iri = InstanceValueNode.iri(node);
    if (!iri || !validAbsoluteFieldIri(iri)) return;
    const authority = authorityDescriptorFor(component.basicInfo.inputType as InputType);
    if (!authority && component.basicInfo.inputType !== InputType.controlled) return;
    let field = this.context.dataContext.templateInput as SchemaNode | undefined;
    for (const part of component.path) {
      field = field?.properties?.[part];
      if (field?.type === 'array') field = field.items;
    }
    const url = authority
      ? this.bridgeBaseUrl && `${this.bridgeBaseUrl}ext-auth/${authority.detailsPath}/verify`
      : this.terminologyBaseUrl && `${this.terminologyBaseUrl}bioportal/validate-term`;
    const body = authority ? { iri } : { iri, valueConstraints: field?._valueConstraints ?? {} };
    const answer = this.semantic.inspect(url, body, iri);
    report.semanticChecks.push({ ...answer, path: [...component.path], occurrences: [...occurrences] });
    if (answer.status !== 'passed') {
      report.problems.push(
        new ValidationProblem(
          component.path,
          component.name,
          component.basicInfo.inputType,
          answer.code,
          answer.message,
          iri,
          occurrences,
        ),
      );
    }
  }
  private readonly regex = new RegexChecks(() => {
    if (this.disposed) return;
    this.validate();
    this.context.validationChanged();
  });

  constructor(private readonly context: HandlerContext) {}

  /** Host report/save reads retry expired semantic evidence without rebuilding every fresh report. */
  refreshSemantic(): void {
    if (!this.disposed && this.semantic.hasExpired()) this.validate();
  }

  async settled(): Promise<void> {
    do {
      await Promise.all([this.regex.settled(), this.semantic.settled()]);
      if (!this.disposed) this.validate();
    } while (!this.disposed && (this.regex.pending || this.semantic.pending));
  }

  dispose(): void {
    this.disposed = true;
    this.regex.dispose();
    this.semantic.dispose();
  }

  private currentNode(component: FieldComponent): InstanceNode | null {
    return this.context.getCurrentValueNode(component);
  }

  draftAt(node: InstanceNode): FieldDraft | null {
    return this.drafts.get(node) ?? null;
  }

  restoreDraft(node: InstanceNode, draft: FieldDraft): void {
    this.drafts.set(node, structuredClone(draft));
  }

  captureDrafts(root: InstanceNode): CeeRecoveryDraft['drafts'] {
    const result: CeeRecoveryDraft['drafts'] = [];
    const visit = (node: InstanceNode, path: Array<string | number>) => {
      const draft = this.draftAt(node);
      if (draft) result.push({ path, draft: structuredClone(draft) });
      if (Array.isArray(node)) node.forEach((child, index) => visit(child, [...path, index]));
      else if (isInstanceObject(node))
        Object.entries(node.values).forEach(([key, child]) => visit(child, [...path, key]));
    };
    visit(root, []);
    return result;
  }

  /** Validate every address before attaching any unfinished input. */
  restoreDrafts(root: InstanceNode, drafts: CeeRecoveryDraft['drafts']): void {
    if (!Array.isArray(drafts)) throw new Error('Invalid recovery drafts');
    const seen = new Set<string>();
    const entries = drafts.map((entry) => {
      if (
        !Array.isArray(entry?.path) ||
        !entry.path.length ||
        entry.path.some(
          (part) => typeof part !== 'string' && !(typeof part === 'number' && Number.isSafeInteger(part) && part >= 0),
        )
      )
        throw new Error('Invalid recovery address');
      const key = JSON.stringify(entry.path);
      const node = entry.path.reduce<InstanceNode | null>((parent, part) => childOf(parent, part), root);
      if (
        !node ||
        typeof node !== 'object' ||
        seen.has(key) ||
        typeof entry.draft?.code !== 'string' ||
        typeof entry.draft?.message !== 'string'
      )
        throw new Error('Invalid recovery input');
      seen.add(key);
      return { node, draft: structuredClone(entry.draft) };
    });
    entries.forEach(({ node, draft }) => this.restoreDraft(node, draft));
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

  /** Judge the current model before the export writer completes missing slots. */
  private collectStructural(report: DataQualityReport): void {
    const data = this.context.dataContext;
    const template = data.templateRepresentation;
    if (!(template instanceof CedarTemplate) || !template.parsed || !data.instanceFullData) return;
    const model = InstanceValidator.validateReport(data.instanceFullData, template.parsed).findings;
    const findings = [
      ...model,
      ...InstanceDeserializer.structuralFindings(data.instanceFullData).filter(
        (finding) => !model.some((current) => current.category === 'structural' && current.path === finding.path),
      ),
    ];
    for (const finding of findings) {
      if (finding.category !== 'structural') continue;
      const path: string[] = [];
      const occurrences: number[] = [];
      let schema = data.templateInput as SchemaNode | null | undefined;
      for (const part of finding.path
        .slice(1)
        .split('/')
        .map((value) => value.replace(/~1/g, '/').replace(/~0/g, '~'))) {
        if (schema?.type === 'array' && /^(0|[1-9]\d*)$/.test(part)) {
          occurrences.push(Number(part));
          schema = schema.items;
        } else if (schema?.properties && Object.hasOwn(schema.properties, part)) {
          path.push(part);
          schema = schema.properties[part];
        } else break;
        // Atom properties belong to the field's diagnostic, not the navigation path.
        if (schema?._ui?.inputType) break;
      }
      const key = JSON.stringify([path, occurrences, finding.code]);
      const existing = report.problems.findIndex(
        (problem) => JSON.stringify([problem.path, problem.occurrences, problem.code]) === key,
      );
      const previous = report.problems[existing];
      const problem = new ValidationProblem(
        path,
        path.at(-1) ?? '',
        previous?.inputType ?? schema?._ui?.inputType ?? (schema?.properties ? 'element' : null),
        finding.code,
        finding.message,
        previous?.value ?? null,
        occurrences,
        undefined,
        finding.path,
      );
      if (existing === -1) report.problems.push(problem);
      else report.problems[existing] = problem;
    }
  }

  validate(): void {
    const data = this.context.dataContext;
    this.semantic.begin();
    const report = this.regex.run(() => {
      const current = this.builder.buildReport(data, this.context);
      this.collectStructural(current);
      return current;
    });
    this.semantic.end();
    if (this.semantic.pending) report.pendingValidation = true;
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
    if (template === null || data.instanceFullData === null) {
      report.isValid = false;
      report.structurallyValid = false;
      report.canSave = false;
    }
    data.dataQualityReport = report;
  }
}

interface SchemaNode {
  type?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  _valueConstraints?: object;
  _ui?: { inputType?: string };
}
