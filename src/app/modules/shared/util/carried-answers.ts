import * as _ from 'lodash-es';
import { InstanceDataAttributeValueFieldName, TemplateInstance } from 'cedar-model-typescript-library';
import { CedarComponent } from '../models/component/cedar-component.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { AbstractFieldComponent } from '../models/field/abstract-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InstanceNode, InstanceObject, isInstanceArray, isInstanceObject } from '../models/instance-node.model';
import { InputType } from '../models/input-type.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { carriedValue, holdsAnswer, compatibleDraft } from './carried-value';
import { DataObjectUtil } from './data-object-util';
import { InstanceValueNode } from './instance-value-node';
import type { HandlerContext } from './handler-context';
import { CarriedAnswerValidation } from './carried-answer-validation';

export interface CarriedForm {
  readonly template: CedarTemplate;
  readonly instance: TemplateInstance;
}

/** A single element's one occurrence is also addressed with a zero. */
export type FormPlace = ReadonlyArray<string | number>;
export interface CarriedCursor {
  readonly place: FormPlace;
  readonly index: number;
}

type Holding = 'one' | 'paged' | 'selection';
interface Carried {
  readonly node: InstanceNode;
  readonly answered: boolean;
}
interface Entry extends Carried {
  readonly origin: number | null;
}
type Restated =
  | { kind: 'kept'; node: InstanceNode; origin: number; answered: boolean }
  | { kind: 'default' | 'rejected'; origin: number };

/**
 * The preview's synchronization boundary. Match declarations once, migrate their
 * editing state, then repair only unexpected findings. The candidate is private
 * until this returns; an unrecoverable structural failure may still refuse it.
 */
export function carryAnswers(
  previous: CarriedForm,
  next: CarriedForm,
  before: HandlerContext,
  after: HandlerContext,
): boolean {
  const validation = new CarriedAnswerValidation(
    previous,
    before.dataContext.dataQualityReport,
    next,
    after.dataContext.dataQualityReport,
  );
  const carrier = new AnswerCarrier(before, after, validation);
  carrier.container(previous.template, next.template, previous.instance.dataContainer, next.instance.dataContainer, []);
  const settle = () => {
    after.multiInstanceObjectService.buildNewOrFromMetadata(next.template, next.instance.dataContainer);
    carrier.restoreCursors(next);
    after.dataContext.invalidateDerivedViews();
    after.buildQualityReport();
  };
  settle();
  // Every successful repair replaces a bad value or removes an optional branch.
  // Re-resolve after each repair: removing an occurrence changes report addresses.
  for (;;) {
    const problems = validation.unexpected(next, after.dataContext.dataQualityReport);
    if (problems.length === 0) {
      after.previewEdits.seed(next.instance.dataContainer);
      return true;
    }
    if (!validation.repair(next, problems[0], after.dataObjectBuilderService)) return false;
    settle();
  }
}

class AnswerCarrier {
  private readonly additions = new Map<CedarComponent, InstanceNode>();
  /** Object references survive pruning, unlike an address captured before repair. */
  private readonly cursors = new WeakMap<InstanceNode[], InstanceNode[]>();

  constructor(
    private readonly before: HandlerContext,
    private readonly after: HandlerContext,
    private readonly validation: CarriedAnswerValidation,
  ) {}

  container(
    before: AbstractElementComponent,
    after: AbstractElementComponent,
    answered: InstanceObject,
    target: InstanceObject,
    place: FormPlace,
  ): boolean {
    let anything = false;
    const declared = new Set(after.children.map((child) => child.name));
    for (const [previous, component] of correspondingChildren(before, after)) {
      const answer = answered.values[previous.name];
      if (answer === undefined) continue;
      const fresh = target.values[component.name] ?? null;
      const childPlace = [...place, previous.name];
      const carried =
        previous instanceof AbstractFieldComponent && component instanceof AbstractFieldComponent
          ? this.field(previous, component, answer, fresh, childPlace, declared)
          : previous instanceof AbstractElementComponent && component instanceof AbstractElementComponent
            ? this.element(previous, component, answer, fresh, childPlace)
            : null;
      if (carried === null) continue;
      target.setValue(component.name, carried.node);
      if (component instanceof AbstractFieldComponent && component.basicInfo.inputType === InputType.attributeValue) {
        this.attributes(component, carried.node, answered, target);
      }
      anything ||= carried.answered;
    }
    return anything;
  }

  private field(
    before: AbstractFieldComponent,
    after: AbstractFieldComponent,
    answer: InstanceNode,
    fresh: InstanceNode | null,
    place: FormPlace,
    declared: ReadonlySet<string>,
  ): Carried | null {
    // Values and cursors have independent lifetimes. Even a pristine list has a pager.
    if (!this.before.previewEdits.edited(answer)) {
      if (fresh === null) return null;
      if (Array.isArray(fresh) && holdingOf(after) === 'paged') {
        this.rememberCursor(
          before,
          place,
          fresh.map((node, origin) => ({ node, origin, answered: false })),
          fresh,
        );
      }
      if (_.isEqual(answer, fresh)) this.validation.inherit(answer, fresh, true);
      return { node: fresh, answered: false };
    }
    const restated: Restated[] = entriesOf(answer).map((entry, origin) => {
      const paged = holdingOf(before) === 'paged';
      if (paged && !this.before.previewEdits.edited(entry)) return { kind: 'default', origin };
      const draft = this.before.validation.draftAt(entry);
      const retainDraft = draft !== null && compatibleDraft(before, after);
      const node = carriedValue(before, after, entry);
      if (node === null || (node instanceof InstanceDataAttributeValueFieldName && declared.has(node.name)))
        return { kind: 'rejected', origin };
      const baseline =
        after instanceof MultiFieldComponent
          ? this.freshEntry(after, fresh, paged ? this.before.previewEdits.slot(entry) : 0)
          : (fresh ?? DataObjectUtil.getEmptyValueWrapper(after));
      this.after.previewEdits.inherit(this.before.previewEdits, entry, node, baseline);
      if (!paged) this.after.previewEdits.own(node);
      this.validation.inherit(entry, node);
      if (retainDraft) this.after.validation.restoreDraft(node, draft);
      return { kind: 'kept', node, origin, answered: holdsAnswer(node) || retainDraft };
    });
    const given = restated.filter((entry): entry is Extract<Restated, { kind: 'kept' }> => entry.kind === 'kept');
    const holding = holdingOf(after);
    if (holding === 'one') {
      const chosen = given.find((entry) => entry.answered) ?? given[0];
      return chosen ? { node: chosen.node, answered: chosen.answered } : null;
    }
    if (!(after instanceof MultiFieldComponent)) return null;
    if (holding === 'selection') {
      if (given.length === 0 && restated.length > 0) return null;
      const entries = distinct(given).map((entry): Entry => ({ ...entry, answered: holdsAnswer(entry.node) }));
      const fitted = fit(before, after, entries, () => DataObjectUtil.getEmptyValueWrapper(after));
      return this.list(answer, fresh, fitted, false, before, place);
    }
    const entries: Entry[] =
      holdingOf(before) === 'paged'
        ? restated.map((entry) => {
            if (entry.kind === 'kept') return entry;
            const old = entriesOf(answer)[entry.origin];
            const node = this.freshEntry(after, fresh, this.before.previewEdits.slot(old));
            if (entry.kind === 'default') {
              this.after.previewEdits.inherit(this.before.previewEdits, old, node, node);
              if (_.isEqual(old, node)) this.validation.inherit(old, node);
            }
            return { node, answered: false, origin: entry.origin };
          })
        : given.map((entry) => ({ node: entry.node, answered: entry.answered, origin: null }));
    // An explicit empty collection is an edit. Only rejected nonempty input falls back.
    if (entries.length === 0 && entriesOf(answer).length > 0) return null;
    const fitted = fit(before, after, entries, (index) => this.freshEntry(after, fresh, index));
    return this.list(answer, fresh, fitted, true, before, place);
  }

  private element(
    before: AbstractElementComponent,
    after: AbstractElementComponent,
    answer: InstanceNode,
    fresh: InstanceNode | null,
    place: FormPlace,
  ): Carried | null {
    const edited = this.before.previewEdits.edited(answer);
    const oldEntries = entriesOf(answer);
    const freshEntries = entriesOf(fresh);
    const occurrences = edited ? oldEntries : freshEntries;
    const entries: Entry[] = [];
    occurrences.forEach((occurrence, origin) => {
      const old = oldEntries[origin];
      if (!isInstanceObject(old)) {
        entries.push({ node: occurrence, origin: null, answered: false });
        return;
      }
      const slot = edited ? this.before.previewEdits.slot(old) : origin;
      const seeded = slot === null ? undefined : freshEntries[slot];
      const target = isInstanceObject(seeded) ? this.cloneFresh(seeded) : this.newEntry(after);
      const answered = this.container(before, after, old, target, [...place, origin]);
      this.after.previewEdits.inherit(this.before.previewEdits, old, target, target);
      this.validation.inherit(old, target);
      entries.push({ node: target, answered, origin });
    });
    if (!(after instanceof MultiElementComponent)) {
      const chosen = entries.find((entry) => entry.answered) ?? entries[0];
      return chosen ? { node: chosen.node, answered: chosen.answered } : null;
    }
    const fitted = fit(before, after, entries, (index) => this.freshEntry(after, fresh, index));
    return this.list(answer, fresh, fitted, true, before, place);
  }

  private list(
    answer: InstanceNode,
    fresh: InstanceNode | null,
    entries: Entry[],
    paged: boolean,
    before: CedarComponent,
    place: FormPlace,
  ): Carried {
    const nodes = entries.map((entry) => entry.node);
    this.after.previewEdits.inherit(this.before.previewEdits, answer, nodes, fresh ?? []);
    this.validation.inherit(answer, nodes);
    if (fresh) this.validation.copyFresh(fresh, nodes, false);
    if (paged) this.rememberCursor(before, place, entries, nodes);
    return { node: nodes, answered: entries.some((entry) => entry.answered) };
  }

  private attributes(
    field: AbstractFieldComponent,
    carried: InstanceNode,
    answered: InstanceObject,
    target: InstanceObject,
  ): void {
    let named = false;
    for (const slot of entriesOf(carried)) {
      if (!(slot instanceof InstanceDataAttributeValueFieldName) || slot.name === '') continue;
      named = true;
      if (target.hasValue(slot.name) || !answered.hasValue(slot.name)) continue;
      target.setValue(slot.name, _.cloneDeep(answered.values[slot.name]));
      if (answered.hasIri(slot.name)) target.setIri(slot.name, answered.iris[slot.name]);
    }
    if (named) target.removeIri(field.name);
  }

  private rememberCursor(before: CedarComponent, place: FormPlace, entries: Entry[], nodes: InstanceNode[]): void {
    const chosen = holdingOf(before) === 'paged' ? this.before.multiInstanceObjectService.chosenIndexAt(place) : null;
    const exact = entries.findIndex((entry) => entry.origin === chosen);
    const index =
      exact >= 0
        ? exact
        : Math.max(
            _.findLastIndex(entries, (entry) => entry.origin !== null && chosen !== null && entry.origin < chosen),
            0,
          );
    this.cursors.set(nodes, nodes.slice(0, index + 1).reverse());
  }

  restoreCursors(form: CarriedForm): void {
    const visit = (component: AbstractElementComponent, container: InstanceObject, place: FormPlace) => {
      for (const child of component.children) {
        const node = container.values[child.name];
        if (node === undefined) continue;
        const childPlace = [...place, child.name];
        if (Array.isArray(node)) {
          const cursor = this.cursors.get(node);
          if (cursor) {
            const surviving = cursor.find((entry) => node.includes(entry));
            this.after.multiInstanceObjectService.setCurrentIndexAt(
              childPlace,
              surviving ? node.indexOf(surviving) : 0,
            );
          }
        }
        if (child instanceof AbstractElementComponent) {
          entriesOf(node).forEach((entry, index) => {
            if (isInstanceObject(entry)) visit(child, entry, [...childPlace, index]);
          });
        }
      }
    };
    visit(form.template, form.instance.dataContainer, []);
  }

  private cloneFresh<T extends InstanceNode>(node: T, slot: number | null = 0): T {
    const copy = _.cloneDeep(node);
    this.validation.copyFresh(node, copy);
    this.after.previewEdits.seed(copy, slot);
    return copy;
  }

  private freshEntry(
    after: MultiFieldComponent | MultiElementComponent,
    fresh: InstanceNode | null,
    index: number | null,
  ): InstanceNode {
    const held = index === null ? undefined : entriesOf(fresh)[index];
    return held === undefined ? this.addition(after) : this.cloneFresh(held, index);
  }

  private newEntry(component: AbstractElementComponent): InstanceObject {
    const entry = component instanceof MultiElementComponent ? this.addition(component) : null;
    return isInstanceObject(entry) ? entry : this.after.dataObjectBuilderService.buildOccurrence(component);
  }

  private addition(component: MultiFieldComponent | MultiElementComponent): InstanceNode {
    let built = this.additions.get(component);
    if (built === undefined) {
      built =
        this.after.dataObjectBuilderService.buildAddedOccurrence(component) ??
        (component instanceof MultiFieldComponent
          ? DataObjectUtil.getEmptyValueWrapper(component)
          : this.after.dataObjectBuilderService.buildOccurrence(component));
      this.additions.set(component, built);
    }
    const copy = _.cloneDeep(built);
    this.after.previewEdits.seed(copy, null);
    return copy;
  }
}
/**
 * Which child of the new container continues which child of the old one, as
 * `[old, new]` pairs in the new container's order.
 *
 * By property IRI first, where one names exactly one child on each side, because
 * the IRI is what the instance's property is and the key only spells it: a field
 * whose key follows its name keeps its IRI while its author renames it. Then by
 * key, for children without IRIs and for an IRI the author replaced. A child that
 * holds no answer — a page break, an image — has nothing to continue.
 */
function correspondingChildren(
  before: AbstractElementComponent,
  after: AbstractElementComponent,
): Array<[CedarComponent, CedarComponent]> {
  const was = before.children.filter(holdsAnswers);
  const now = after.children.filter(holdsAnswers);
  const continued = new Map<CedarComponent, CedarComponent>();
  const taken = new Set<CedarComponent>();
  const pair = (previous: CedarComponent | undefined, component: CedarComponent): void => {
    if (previous !== undefined && !taken.has(previous) && sameKind(previous, component)) {
      continued.set(component, previous);
      taken.add(previous);
    }
  };
  const wasByIri = byUniqueIri(was);
  for (const [iri, component] of byUniqueIri(now)) {
    pair(wasByIri.get(iri), component);
  }
  for (const component of now) {
    if (!continued.has(component)) {
      pair(
        was.find((previous) => previous.name === component.name),
        component,
      );
    }
  }
  return now.flatMap((component): Array<[CedarComponent, CedarComponent]> => {
    const previous = continued.get(component);
    return previous === undefined ? [] : [[previous, component]];
  });
}

function holdsAnswers(component: CedarComponent): boolean {
  return component instanceof AbstractFieldComponent || component instanceof AbstractElementComponent;
}

function sameKind(previous: CedarComponent, component: CedarComponent): boolean {
  return previous instanceof AbstractFieldComponent === component instanceof AbstractFieldComponent;
}

/** The children by property IRI, leaving out any IRI two children share. */
function byUniqueIri(children: CedarComponent[]): Map<string, CedarComponent> {
  const found = new Map<string, CedarComponent | null>();
  for (const child of children) {
    if (child.propertyIri) {
      found.set(child.propertyIri, found.has(child.propertyIri) ? null : child);
    }
  }
  const unique = new Map<string, CedarComponent>();
  for (const [iri, child] of found) {
    if (child !== null) {
      unique.set(iri, child);
    }
  }
  return unique;
}

function holdingOf(component: CedarComponent): Holding {
  if (component instanceof MultiElementComponent) {
    return 'paged';
  }
  if (component instanceof MultiFieldComponent) {
    return component.isMultiPage() ? 'paged' : 'selection';
  }
  return 'one';
}

/**
 * The entries a list keeps within its bounds.
 *
 * Past a maximum the author has lowered, entries holding no answer go first, from the
 * end, and then the last of the rest. A list already past a maximum the author has
 * not lowered was made that way by the reader, as a checkbox group can be, and is not
 * the carrying's to cut. Short of the minimum, `fill` supplies what a new form holds
 * at each missing position.
 */
function fit(
  before: CedarComponent,
  after: MultiFieldComponent | MultiElementComponent,
  entries: Entry[],
  fill: (index: number) => InstanceNode,
): Entry[] {
  const kept = [...entries];
  const limit = boundAfter(before, after, entries.length);
  if (limit !== null) {
    while (kept.length > limit) {
      const unanswered = _.findLastIndex(kept, (entry) => !entry.answered);
      kept.splice(unanswered === -1 ? kept.length - 1 : unanswered, 1);
    }
  }
  while (kept.length < after.multiInfo.getSafeMinItems()) {
    kept.push({ node: fill(kept.length), answered: false, origin: null });
  }
  return kept;
}

/** How many entries a list may keep: the new maximum, unless the reader went past one no lower. */
function boundAfter(
  before: CedarComponent,
  after: MultiFieldComponent | MultiElementComponent,
  count: number,
): number | null {
  const now = after.multiInfo.maxItems;
  if (now === null) {
    return null;
  }
  const was =
    before instanceof MultiFieldComponent || before instanceof MultiElementComponent ? before.multiInfo.maxItems : 1;
  return was !== null && now >= was ? Math.max(now, count) : Math.max(now, 0);
}

/** The selections, each once. */
function distinct(
  entries: Array<{ node: InstanceNode; origin: number }>,
): Array<{ node: InstanceNode; origin: number }> {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const label = InstanceValueNode.literal(entry.node) ?? InstanceValueNode.iri(entry.node) ?? '';
    if (seen.has(label)) {
      return false;
    }
    seen.add(label);
    return true;
  });
}

/** A node's entries: a list's, or a single component's one node. */
function entriesOf(node: InstanceNode | null): InstanceNode[] {
  if (isInstanceArray(node)) {
    return node;
  }
  return node === null ? [] : [node];
}
