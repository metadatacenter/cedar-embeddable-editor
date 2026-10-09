/**
 * Templates and a reader, for testing what a form keeps when its template changes.
 *
 * A template is described as plain data and written by the model library, the way
 * the designer writes the templates it previews. The reader edits the form through
 * `HandlerContext`, the way CEE's widgets do, so what the carrying takes to be an
 * answer is exactly what typing into the form produces.
 */
import { vi } from 'vitest';
import {
  BiboStatus,
  CedarBuilders,
  CedarWriters,
  ChildDeploymentInfoAlwaysMultipleBuilder,
  ChildDeploymentInfoBuilder,
  ChildDeploymentInfoElementBuilder,
  AbstractFieldChildDeploymentInfoBuilder,
  AbstractDynamicChildDeploymentInfoBuilder,
  Iri,
  NumberType,
  SchemaVersion,
  TemporalGranularity,
  TemporalType,
  TemplateField,
} from 'cedar-model-typescript-library';
import type { AbstractChildDeploymentInfo, TemplateChild } from 'cedar-model-typescript-library';
import type { CeeJsonObject } from '../../../cee-public-api';
import { CedarComponent } from '../models/component/cedar-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { MultiComponent } from '../models/component/multi-component.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { AbstractFieldComponent } from '../models/field/abstract-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InstanceNode, childOf, isInstanceArray } from '../models/instance-node.model';
import { MessageHandlerService } from '../service/message-handler.service';
import { ArtifactInputCoordinator } from './artifact-input-coordinator';
import { InstanceValueNode } from './instance-value-node';
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';
import { FieldDraft } from '../validation/validation-coordinator';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'numeric'
  | 'temporal'
  | 'radio'
  | 'checkbox'
  | 'list'
  | 'multiList'
  | 'link'
  | 'orcid'
  | 'attribute';

export interface FieldSpec {
  readonly kind: FieldKind;
  readonly key: string;
  /** The property IRI; one derived from the key unless given, and none when null. */
  readonly iri?: string | null;
  readonly multi?: boolean;
  readonly min?: number | null;
  readonly max?: number | null;
  readonly options?: readonly string[];
  readonly selected?: readonly string[];
  readonly default?: string | number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly regex?: string;
  readonly numberType?: string;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly decimals?: number;
  readonly temporalType?: 'xsd:date' | 'xsd:dateTime' | 'xsd:time';
  readonly granularity?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'decimalSecond';
  readonly timezone?: boolean;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly label?: string;
  readonly help?: string;
}

export interface ElementSpec {
  readonly element: readonly ChildSpec[];
  readonly key: string;
  readonly iri?: string | null;
  readonly multi?: boolean;
  readonly min?: number | null;
  readonly max?: number | null;
}

export type ChildSpec = FieldSpec | ElementSpec;

export interface TemplateOptions {
  readonly id?: string;
  readonly description?: string;
}

const TEMPLATE_ID = 'https://repo.metadatacenter.org/templates/7e5b1c2a-0000-4000-8000-000000000001';

const propertyIri = (key: string): string => `https://schema.metadatacenter.org/properties/${encodeURIComponent(key)}`;
const fieldId = (key: string): string => `https://repo.metadatacenter.org/template-fields/${encodeURIComponent(key)}`;
const elementId = (key: string): string =>
  `https://repo.metadatacenter.org/template-elements/${encodeURIComponent(key)}`;

/** A template holding these children, as CEDAR JSON. */
export function templateJson(children: readonly ChildSpec[], options: TemplateOptions = {}): CeeJsonObject {
  const builder = CedarBuilders.templateBuilder()
    .withAtId(options.id ?? TEMPLATE_ID)
    .withSchemaName('Kit')
    .withSchemaDescription(options.description ?? '')
    .withSchemaVersion(SchemaVersion.CURRENT)
    .withStatus(BiboStatus.DRAFT);
  for (const child of children) {
    const [built, deployment] = deployed(child);
    builder.addChild(built, deployment);
  }
  const template = builder.build();
  return CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template) as unknown as CeeJsonObject;
}

/** A child and how its parent holds it, as `addChild` takes them. */
type Deployed = [TemplateChild, AbstractChildDeploymentInfo];

function deployed(child: ChildSpec): Deployed {
  const iri = child.iri === undefined ? propertyIri(child.key) : child.iri;
  if ('element' in child) {
    const builder = CedarBuilders.templateElementBuilder()
      .withAtId(elementId(child.key))
      .withSchemaName(child.key)
      .withSchemaVersion(SchemaVersion.CURRENT)
      .withStatus(BiboStatus.DRAFT);
    for (const nested of child.element) {
      const [built, deployment] = deployed(nested);
      builder.addChild(built, deployment);
    }
    const element = builder.build();
    const deployment: ChildDeploymentInfoElementBuilder = element.createDeploymentBuilder(child.key);
    deployment
      .withMultiInstance(child.multi === true)
      .withMinItems(child.min ?? null)
      .withMaxItems(child.max ?? null);
    if (iri !== null) deployment.withIri(iri);
    return [element, deployment.build()];
  }
  const field = fieldOf(child);
  const deployment = field.createDeploymentBuilder(child.key);
  if (deployment instanceof AbstractDynamicChildDeploymentInfoBuilder && iri !== null) deployment.withIri(iri);
  if (deployment instanceof AbstractFieldChildDeploymentInfoBuilder) {
    deployment.withRequiredValue(child.required === true).withHidden(child.hidden === true);
    deployment.withLabel(child.label ?? null);
  }
  if (deployment instanceof ChildDeploymentInfoBuilder) {
    deployment
      .withMultiInstance(child.multi === true)
      .withMinItems(child.min ?? null)
      .withMaxItems(child.max ?? null);
  } else if (deployment instanceof ChildDeploymentInfoAlwaysMultipleBuilder) {
    deployment.withMinItems(child.min ?? null).withMaxItems(child.max ?? null);
  }
  return [field, deployment.build()];
}

function fieldOf(spec: FieldSpec): TemplateField {
  const selected = new Set(spec.selected ?? []);
  const named = <T extends { withAtId(id: string): T; withSchemaName(name: string): T }>(builder: T): T =>
    builder.withAtId(fieldId(spec.key)).withSchemaName(spec.key);
  const text = spec.default === undefined ? null : String(spec.default);
  switch (spec.kind) {
    case 'text':
      return named(CedarBuilders.textFieldBuilder())
        .withMinLength(spec.minLength ?? null)
        .withMaxLength(spec.maxLength ?? null)
        .withRegex(spec.regex ?? null)
        .withDefaultValue(text)
        .withSchemaDescription(spec.help ?? null)
        .build();
    case 'textarea':
      return named(CedarBuilders.textAreaBuilder())
        .withMinLength(spec.minLength ?? null)
        .withMaxLength(spec.maxLength ?? null)
        .withDefaultValue(text)
        .build();
    case 'email':
      return named(CedarBuilders.emailFieldBuilder()).withDefaultValue(text).build();
    case 'phone':
      return named(CedarBuilders.phoneNumberFieldBuilder()).withDefaultValue(text).build();
    case 'numeric':
      return named(CedarBuilders.numericFieldBuilder())
        .withNumberType(NumberType.forValue(spec.numberType ?? 'xsd:decimal'))
        .withMinValue(spec.minValue ?? null)
        .withMaxValue(spec.maxValue ?? null)
        .withDecimalPlaces(spec.decimals ?? null)
        .withDefaultValue(spec.default === undefined ? null : Number(spec.default))
        .build();
    case 'temporal':
      return named(CedarBuilders.temporalFieldBuilder())
        .withTemporalType(TemporalType.forValue(spec.temporalType ?? 'xsd:date'))
        .withTemporalGranularity(TemporalGranularity.forValue(spec.granularity ?? 'day'))
        .withTimezoneEnabled(spec.timezone === true)
        .withDefaultValue(text)
        .build();
    case 'radio': {
      const builder = named(CedarBuilders.radioFieldBuilder());
      for (const option of spec.options ?? []) builder.addRadioOption(option, selected.has(option));
      return builder.build();
    }
    case 'checkbox': {
      const builder = named(CedarBuilders.checkboxFieldBuilder());
      for (const option of spec.options ?? []) builder.addCheckboxOption(option, selected.has(option));
      return builder.build();
    }
    case 'list': {
      const builder = named(CedarBuilders.singleChoiceListFieldBuilder());
      for (const option of spec.options ?? []) builder.addListOption(option, selected.has(option));
      return builder.build();
    }
    case 'multiList': {
      const builder = named(CedarBuilders.multipleChoiceListFieldBuilder());
      for (const option of spec.options ?? []) builder.addListOption(option, selected.has(option));
      return builder.build();
    }
    case 'link':
      return named(CedarBuilders.linkFieldBuilder())
        .withDefaultValue(text === null ? null : new Iri(text))
        .build();
    case 'orcid':
      return named(CedarBuilders.extOrcidFieldBuilder()).build();
    case 'attribute':
      return named(CedarBuilders.attributeValueFieldBuilder()).build();
  }
}

/** A step of a place in the form: a key, or the entry of the list named just before it. */
export type Step = string | number;

/**
 * Someone filling in the form: they type, choose, add entries and turn pagers, all
 * through the editor's own API.
 */
export class Reader {
  readonly coordinator: ArtifactInputCoordinator;
  readonly error = vi.fn();
  readonly trace = vi.fn();

  constructor() {
    this.coordinator = new ArtifactInputCoordinator({
      error: this.error,
      trace: this.trace,
      warning: vi.fn(),
    } as unknown as MessageHandlerService);
  }

  /** Open this template, or replace the one open with it, and check that it was taken. */
  open(template: CeeJsonObject): this {
    if (!this.coordinator.acceptTemplate(template)) {
      throw new Error(`template refused: ${JSON.stringify(this.error.mock.calls)}`);
    }
    return this;
  }

  private get handler() {
    return this.coordinator.state.handlerContext;
  }

  /** Turn the pagers along a place and return the component it ends at. */
  private visit(place: readonly Step[]): CedarComponent {
    const root = this.coordinator.state.dataContext.templateRepresentation;
    let container: AbstractElementComponent | null = root instanceof AbstractElementComponent ? root : null;
    let component: CedarComponent | null = null;
    for (const step of place) {
      if (typeof step === 'number') {
        if (
          component === null ||
          !(component instanceof MultiFieldComponent || component instanceof MultiElementComponent)
        ) {
          throw new Error(`no list before entry ${step} in ${place.join('/')}`);
        }
        this.handler.setCurrentIndex(component as MultiComponent, step);
        continue;
      }
      if (container === null) throw new Error(`no element before ${step} in ${place.join('/')}`);
      component = container.getChildByName(step);
      if (component === null) throw new Error(`no ${step} in ${place.join('/')}`);
      container = component instanceof AbstractElementComponent ? component : null;
    }
    if (component === null) throw new Error('an empty place');
    return component;
  }

  private field(place: readonly Step[]): FieldComponent {
    const component = this.visit(place);
    if (!(component instanceof AbstractFieldComponent)) throw new Error(`${place.join('/')} is not a field`);
    return component;
  }

  /** Type into a field, or into the entry of its list named last. */
  type(place: readonly Step[], value: string | null): this {
    this.handler.changeValue(this.field(place), value);
    return this;
  }

  typeDraft(place: readonly Step[], draft: FieldDraft): this {
    this.handler.changeValue(this.field(place), null, draft);
    return this;
  }

  draft(place: readonly Step[]): FieldDraft | null {
    return this.handler.validation.draftFor(this.field(place));
  }

  /** Choose these options of a checkbox group or a multiple-choice list. */
  choose(place: readonly Step[], labels: string[]): this {
    this.handler.changeListValue(this.field(place), labels);
    return this;
  }

  /** Add an entry after the one a list's pager is on, and turn to it. */
  add(place: readonly Step[], times = 1): this {
    for (let i = 0; i < times; i++) {
      const component = this.visit(place);
      if (!this.handler.addMultiInstance(component as MultiComponent))
        throw new Error(`could not add to ${place.join('/')}`);
    }
    return this;
  }

  remove(place: readonly Step[]): this {
    if (!this.handler.deleteMultiInstance(this.visit(place) as MultiComponent))
      throw new Error(`could not remove from ${place.join('/')}`);
    return this;
  }

  copy(place: readonly Step[]): this {
    if (!this.handler.copyMultiInstance(this.visit(place) as MultiComponent))
      throw new Error(`could not copy ${place.join('/')}`);
    return this;
  }

  /** Turn a list's pager to an entry. */
  turn(place: readonly Step[], index: number): this {
    this.handler.setCurrentIndex(this.visit(place) as MultiComponent, index);
    return this;
  }

  /** Name an attribute in the attribute-value entry the pager is on, and give it a value. */
  attribute(place: readonly Step[], name: string, value: string): this {
    const problem = this.handler.changeAttributeValue(this.field(place), name, value);
    if (problem !== null) throw new Error(`attribute refused: ${JSON.stringify(problem)}`);
    return this;
  }

  /** The node at a place, read from the instance entry by entry rather than through the pagers. */
  node(place: readonly Step[]): InstanceNode | null {
    return place.reduce<InstanceNode | null>(
      (node, step) => childOf(node, step),
      this.coordinator.state.dataContext.instanceFullData?.dataContainer ?? null,
    );
  }

  /** What a field holds at a place: its text, its IRI, or an attribute's name. */
  value(place: readonly Step[]): string | null {
    return plain(this.node(place));
  }

  /** What each entry of a list holds. */
  values(place: readonly Step[]): Array<string | null> {
    const node = this.node(place);
    return isInstanceArray(node) ? node.map(plain) : [];
  }

  /** How many entries a list holds, or null where there is no list. */
  count(place: readonly Step[]): number | null {
    const node = this.node(place);
    return isInstanceArray(node) ? node.length : null;
  }

  /** The XSD type a literal carries. */
  datatype(place: readonly Step[]): string | null {
    const node = this.node(place);
    return node !== null && typeof node === 'object' && 'type' in node && typeof node.type === 'string'
      ? node.type
      : null;
  }

  /** The entry a pager stands on. */
  cursor(place: readonly Step[]): number | null {
    return this.handler.multiInstanceObjectService.chosenIndexAt(place);
  }

  /** Every error the form's report holds, as `path code`. */
  errors(): string[] {
    return (this.coordinator.state.dataContext.dataQualityReport?.problems ?? [])
      .filter((problem) => problem.severity === 'error')
      .map((problem) => `${problem.path.join('/')} ${problem.code}`);
  }
}

function plain(node: InstanceNode | null): string | null {
  if (node instanceof InstanceDataAttributeValueFieldName) return node.name;
  const literal = InstanceValueNode.literal(node);
  if (literal !== undefined) return literal;
  const iri = InstanceValueNode.iri(node);
  return iri ?? null;
}
