import * as _ from 'lodash-es';
import { InstanceDataAttributeValueFieldName, TemplateInstance } from 'cedar-model-typescript-library';
import { DataObjectBuilderHandler } from '../handler/data-object-builder.handler';
import { CedarComponent } from '../models/component/cedar-component.model';
import { DataQualityReport } from '../models/data-quality-report.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { AbstractFieldComponent } from '../models/field/abstract-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InstanceNode, InstanceObject, isInstanceArray, isInstanceObject } from '../models/instance-node.model';
import { InputType } from '../models/input-type.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ValidationProblem } from '../validation/validation-problem.model';
import { carriedValue, holdsAnswer } from './carried-value';
import { DataObjectUtil } from './data-object-util';
import { InstanceValueNode } from './instance-value-node';

/** A form: the template it renders and the instance a reader is filling in. */
export interface CarriedForm {
  readonly template: CedarTemplate;
  readonly instance: TemplateInstance;
}

/**
 * A place in a form, named entry by entry: `['_author', 1, '_affiliation']` is the
 * affiliation list in the second author. A single element's one entry is 0.
 */
export type FormPlace = ReadonlyArray<string | number>;

/** The entry a pager should show once the new form is up. */
export interface CarriedCursor {
  readonly place: FormPlace;
  readonly index: number;
}

/**
 * Move what a reader has entered in one form onto the form built to replace it, as
 * much of it as the new form will take without complaint.
 *
 * A host previewing a template it is editing assigns each edit as a new template,
 * and each one builds a new form. The reader trying the form out should lose as
 * little as possible, and should never be shown an error that comes from the
 * carrying: an answer the new form would flag is dropped without a word.
 *
 * Four rules decide it.
 *
 * - **Which child is which.** A child of the new template continues one of the old
 *   template's children with the same property IRI, which is what the instance's
 *   property is, or failing that with the same key. A field continues a field and an
 *   element an element. So an author renaming a field keeps its answers; a field
 *   moved into another element starts afresh.
 * - **What the reader entered.** An answer is whatever differs from what the old form
 *   started with, rebuilt from the old template to compare against, and an entry the
 *   reader added is compared with what the add button gives. Emptying a default counts:
 *   it stays empty. What the reader left alone is not carried, so it shows the new
 *   template's own state, such as a default the author has just changed.
 * - **Which values survive.** Each answer is kept as it stands, or restated for the new
 *   field, wherever the form's validator finds no error in it that the reader's entry
 *   did not already have — see `carriedValue`.
 * - **How many entries survive.** Entries keep their positions. Past a maximum the
 *   author has lowered, entries holding no answer go first, then the last ones. Short
 *   of a new minimum, the new form's own entries fill in. A field or element that
 *   becomes single keeps its first answered entry; one that becomes repeating holds it
 *   as its first. A checkbox group or multiple-choice list is one answer, its set of
 *   selections, rather than a list of entries.
 *
 * Writes into `next.instance`, which is expected to be the instance just built for
 * `next.template` and not yet shown to anyone, and returns where each pager should
 * stand so that the reader stays on the entry they were looking at, or the nearest
 * one before it that survived. `chosenIndex` reads where a pager stood in the old form.
 */
export function carryAnswers(
  previous: CarriedForm,
  next: CarriedForm,
  builder: DataObjectBuilderHandler,
  chosenIndex: (place: FormPlace) => number | null,
): CarriedCursor[] {
  const started = builder.buildNewFullDataObject(previous.template);
  return new AnswerCarrier(builder, chosenIndex).container(
    previous.template,
    next.template,
    previous.instance.dataContainer,
    started.dataContainer,
    next.instance.dataContainer,
    [],
  ).cursors;
}

/**
 * The errors a report holds, each named by its field and its kind.
 *
 * Not by entry: a form holding more entries than another repeats the template's own
 * problems once for each, and those are not errors the carrying caused.
 */
export function reportedErrors(report: DataQualityReport | null): Set<string> {
  return new Set(
    (report?.problems ?? []).filter((problem) => problem.severity === 'error').map((problem) => errorKey(problem)),
  );
}

/**
 * Put back what the new form would hold wherever its report finds an error that
 * neither a form built afresh nor the reader's own form had, or with `empty`, leave
 * the place empty.
 *
 * `carriedValue` asks the validator the report is built from, so the first pass
 * should rarely find anything. It is here so that the promise holds even where the
 * two see a value differently: whatever is carried, the reader is never shown an
 * error that the template alone, or their own entry, would not show them. The second
 * pass is for a template whose own default its constraints refuse, which a fresh form
 * shows nowhere while it has no entry to put the default in, but which an entry the
 * reader added would. True when anything was changed.
 */
export function withdrawFlaggedAnswers(
  form: CarriedForm,
  report: DataQualityReport | null,
  allowed: ReadonlySet<string>,
  builder: DataObjectBuilderHandler,
  empty = false,
): boolean {
  let withdrawn = false;
  for (const problem of report?.problems ?? []) {
    if (problem.severity === 'error' && !allowed.has(errorKey(problem))) {
      withdrawn = withdrawAt(form, problem, builder, empty) || withdrawn;
    }
  }
  return withdrawn;
}

/** What was carried into one child or one entry. */
interface Carried {
  readonly node: InstanceNode;
  /** Whether it holds anything the reader entered, rather than only what the new form put there. */
  readonly answered: boolean;
  /** Pager positions within it, named from it. */
  readonly cursors: CarriedCursor[];
}

/** One entry of a list being fitted to its new bounds. */
interface Entry extends Carried {
  /** Its position in the old form, or null for an entry the new form supplied. */
  readonly origin: number | null;
}

/** One entry of a field's answer, restated for the new field, or null where nothing survives. */
interface Restated {
  readonly node: InstanceNode | null;
  readonly origin: number;
}

/**
 * How a component holds its entries.
 *
 * `selection` is a checkbox group or a multiple-choice list, whose list is one
 * answer rather than entries the form pages through.
 */
type Holding = 'one' | 'paged' | 'selection';

class AnswerCarrier {
  private readonly additions = new Map<CedarComponent, InstanceNode>();

  constructor(
    private readonly builder: DataObjectBuilderHandler,
    private readonly chosenIndex: (place: FormPlace) => number | null,
  ) {}

  /**
   * Carry the answers held by an element's entry, or by the instance root.
   *
   * `place` names the old entry, so that pagers in it can be read.
   */
  container(
    before: AbstractElementComponent,
    after: AbstractElementComponent,
    answered: InstanceObject,
    started: InstanceObject,
    target: InstanceObject,
    place: FormPlace,
  ): { answered: boolean; cursors: CarriedCursor[] } {
    let anything = false;
    const cursors: CarriedCursor[] = [];
    const declared = new Set(after.children.map((child) => child.name));
    for (const [previous, component] of correspondingChildren(before, after)) {
      if (!answered.hasValue(previous.name)) {
        continue;
      }
      const answer = answered.values[previous.name];
      const start = started.values[previous.name] ?? null;
      if (_.isEqual(answer, start)) {
        continue;
      }
      const fresh = target.values[component.name] ?? null;
      const childPlace = [...place, previous.name];
      const carried =
        previous instanceof AbstractFieldComponent && component instanceof AbstractFieldComponent
          ? this.field(previous, component, answer, start, fresh, childPlace, declared)
          : previous instanceof AbstractElementComponent && component instanceof AbstractElementComponent
            ? this.element(previous, component, answer, start, fresh, childPlace)
            : null;
      if (carried === null) {
        continue;
      }
      target.setValue(component.name, carried.node);
      if (component instanceof AbstractFieldComponent && component.basicInfo.inputType === InputType.attributeValue) {
        this.attributes(component, carried.node, answered, target);
      }
      anything = anything || carried.answered;
      cursors.push(...carried.cursors.map((cursor) => within(component.name, cursor)));
    }
    return { answered: anything, cursors };
  }

  private field(
    before: AbstractFieldComponent,
    after: AbstractFieldComponent,
    answer: InstanceNode,
    start: InstanceNode | null,
    fresh: InstanceNode | null,
    place: FormPlace,
    declared: ReadonlySet<string>,
  ): Carried | null {
    const restated = this.restated(before, after, answer, start, declared);
    const given = restated.filter((entry): entry is { node: InstanceNode; origin: number } => entry.node !== null);
    const holding = holdingOf(after);
    if (holding === 'one') {
      // The first entry holding something, or else an emptied one: clearing a default is an answer too.
      const chosen = given.find((entry) => holdsAnswer(entry.node)) ?? given[0];
      return chosen === undefined ? null : { node: chosen.node, answered: holdsAnswer(chosen.node), cursors: [] };
    }
    if (!(after instanceof MultiFieldComponent)) {
      return null;
    }
    if (holding === 'selection') {
      // Every selection refused: the place shows what a new form holds. None made: an empty selection.
      if (given.length === 0 && restated.length > 0) {
        return null;
      }
      const entries = distinct(given).map((entry): Entry => ({
        ...entry,
        answered: holdsAnswer(entry.node),
        cursors: [],
      }));
      const fitted = fit(before, after, entries, () => DataObjectUtil.getEmptyValueWrapper(after));
      return { node: fitted.map((entry) => entry.node), answered: fitted.some((entry) => entry.answered), cursors: [] };
    }
    const entries: Entry[] =
      holdingOf(before) === 'paged'
        ? restated.map((entry) => ({
            node: entry.node ?? this.freshEntry(after, fresh, entry.origin),
            answered: entry.node !== null && holdsAnswer(entry.node),
            origin: entry.origin,
            cursors: [],
          }))
        : given.map((entry) => ({ node: entry.node, answered: holdsAnswer(entry.node), origin: null, cursors: [] }));
    if (entries.length === 0) {
      return null;
    }
    const fitted = fit(before, after, entries, (index) => this.freshEntry(after, fresh, index));
    return {
      node: fitted.map((entry) => entry.node),
      answered: fitted.some((entry) => entry.answered),
      cursors: [{ place: [], index: this.cursorIndex(before, place, fitted) }],
    };
  }

  /**
   * Each entry of a field's answer, restated for the new field.
   *
   * Only entries the reader changed are restated; the rest come back as null. A
   * single field or a selection differs from where it started as a whole, which is
   * why it is being carried at all, so all its entries count as changed.
   */
  private restated(
    before: AbstractFieldComponent,
    after: AbstractFieldComponent,
    answer: InstanceNode,
    start: InstanceNode | null,
    declared: ReadonlySet<string>,
  ): Restated[] {
    const paged = before instanceof MultiFieldComponent && holdingOf(before) === 'paged';
    const startedEntries = entriesOf(start);
    return entriesOf(answer).map((entry, origin) => {
      const changed = !paged || !_.isEqual(entry, startedEntries[origin] ?? this.addition(before));
      const node = changed ? carriedValue(before, after, entry) : null;
      // An attribute cannot take the name of a property the template declares beside it.
      const clashes = node instanceof InstanceDataAttributeValueFieldName && declared.has(node.name);
      return { node: clashes ? null : node, origin };
    });
  }

  private element(
    before: AbstractElementComponent,
    after: AbstractElementComponent,
    answer: InstanceNode,
    start: InstanceNode | null,
    fresh: InstanceNode | null,
    place: FormPlace,
  ): Carried | null {
    const startedEntries = entriesOf(start);
    const freshEntries = entriesOf(fresh);
    const entries: Entry[] = [];
    entriesOf(answer).forEach((occurrence, origin) => {
      if (!isInstanceObject(occurrence)) {
        return;
      }
      const startedEntry = startedEntries[origin];
      const freshEntry = freshEntries[origin];
      const target = isInstanceObject(freshEntry) ? freshEntry : this.newEntry(after);
      const merged = this.container(
        before,
        after,
        occurrence,
        isInstanceObject(startedEntry) ? startedEntry : this.newEntry(before),
        target,
        [...place, origin],
      );
      entries.push({ node: target, answered: merged.answered, origin, cursors: merged.cursors });
    });
    if (!(after instanceof MultiElementComponent)) {
      const chosen = entries.find((entry) => entry.answered) ?? entries[0];
      return chosen === undefined
        ? null
        : { node: chosen.node, answered: chosen.answered, cursors: chosen.cursors.map((cursor) => within(0, cursor)) };
    }
    if (entries.length === 0) {
      return null;
    }
    const fitted = fit(before, after, entries, (index) => this.freshEntry(after, fresh, index));
    return {
      node: fitted.map((entry) => entry.node),
      answered: fitted.some((entry) => entry.answered),
      cursors: [
        { place: [], index: this.cursorIndex(before, place, fitted) },
        ...fitted.flatMap((entry, index) => entry.cursors.map((cursor) => within(index, cursor))),
      ],
    };
  }

  /**
   * The values an attribute-value field holds, which sit beside it in its container
   * under the names the reader gave them.
   */
  private attributes(
    field: AbstractFieldComponent,
    carried: InstanceNode,
    answered: InstanceObject,
    target: InstanceObject,
  ): void {
    let named = false;
    for (const slot of entriesOf(carried)) {
      if (!(slot instanceof InstanceDataAttributeValueFieldName) || slot.name === '') {
        continue;
      }
      named = true;
      if (target.hasValue(slot.name) || !answered.hasValue(slot.name)) {
        continue;
      }
      target.setValue(slot.name, _.cloneDeep(answered.values[slot.name]));
      if (answered.hasIri(slot.name)) {
        target.setIri(slot.name, answered.iris[slot.name]);
      }
    }
    // Naming an attribute takes the field's own property IRI off the container.
    if (named) {
      target.removeIri(field.name);
    }
  }

  /**
   * Where a pager should stand: on the entry the reader was on, wherever fitting
   * moved it, or on the nearest one before it when that entry went.
   */
  private cursorIndex(before: CedarComponent, place: FormPlace, fitted: Entry[]): number {
    const chosen = holdingOf(before) === 'paged' ? this.chosenIndex(place) : null;
    if (chosen === null || chosen < 0) {
      return 0;
    }
    const kept = fitted.findIndex((entry) => entry.origin === chosen);
    if (kept !== -1) {
      return kept;
    }
    return Math.max(
      _.findLastIndex(fitted, (entry) => entry.origin !== null && entry.origin < chosen),
      0,
    );
  }

  /** What the new form holds at this position of a list, or what the add button gives past its end. */
  private freshEntry(after: MultiFieldComponent | MultiElementComponent, fresh: InstanceNode | null, index: number) {
    const held = entriesOf(fresh)[index];
    return held === undefined ? this.addition(after) : _.cloneDeep(held);
  }

  /** A new entry of an element: what the add button gives a repeating one, or an empty single one. */
  private newEntry(component: AbstractElementComponent): InstanceObject {
    const entry = component instanceof MultiElementComponent ? this.addition(component) : null;
    return isInstanceObject(entry) ? entry : this.builder.buildOccurrence(component);
  }

  /** What the add button gives this component, built once per carry and copied for each use. */
  private addition(component: MultiFieldComponent | MultiElementComponent): InstanceNode {
    let built = this.additions.get(component);
    if (built === undefined) {
      built =
        this.builder.buildAddedOccurrence(component) ??
        (component instanceof MultiFieldComponent
          ? DataObjectUtil.getEmptyValueWrapper(component)
          : this.builder.buildOccurrence(component));
      this.additions.set(component, built);
    }
    return _.cloneDeep(built);
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
    kept.push({ node: fill(kept.length), answered: false, origin: null, cursors: [] });
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

/** A cursor named from a child, named instead from the container holding it. */
function within(step: string | number, cursor: CarriedCursor): CarriedCursor {
  return { place: [step, ...cursor.place], index: cursor.index };
}

/** A field holding nothing: an empty slot, or as many as its list must have. */
function emptied(field: AbstractFieldComponent): InstanceNode {
  if (!(field instanceof MultiFieldComponent)) {
    return DataObjectUtil.getEmptyValueWrapper(field);
  }
  return Array.from({ length: field.multiInfo.getSafeMinItems() }, () => DataObjectUtil.getEmptyValueWrapper(field));
}

function errorKey(problem: ValidationProblem): string {
  return JSON.stringify([problem.path, problem.code]);
}

/** Give one child, in the entries a problem names, what a new form holds for it, or nothing at all. */
function withdrawAt(
  form: CarriedForm,
  problem: ValidationProblem,
  builder: DataObjectBuilderHandler,
  empty: boolean,
): boolean {
  let component: AbstractElementComponent = form.template;
  let container: InstanceNode | null = form.instance.dataContainer;
  let entry = 0;
  for (const [step, name] of problem.path.entries()) {
    const child = component.getChildByName(name);
    if (child === null || !isInstanceObject(container)) {
      return false;
    }
    if (step === problem.path.length - 1) {
      const value = empty && child instanceof AbstractFieldComponent ? emptied(child) : builder.buildChild(child);
      if (value === null) {
        return false;
      }
      container.setValue(name, value);
      return true;
    }
    if (!(child instanceof AbstractElementComponent)) {
      return false;
    }
    const held: InstanceNode | null = container.values[name] ?? null;
    container = child instanceof MultiElementComponent ? (entriesOf(held)[problem.occurrences[entry++]] ?? null) : held;
    component = child;
  }
  return false;
}
