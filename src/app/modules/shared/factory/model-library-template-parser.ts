import {
  AbstractChildDeploymentInfo,
  AbstractContainerArtifact,
  AbstractDynamicChildDeploymentInfo,
  BooleanField,
  CedarArtifactType,
  CedarFieldType,
  CedarReaders,
  CedarWriters,
  CheckboxField,
  ComparisonError,
  ControlledTermField,
  JsonNode,
  JsonTemplateInstanceContent,
  ChildDeploymentInfo,
  MultipleChoiceListField,
  NumericField,
  RadioField,
  SingleChoiceListField,
  StaticImageField,
  StaticRichTextField,
  StaticYoutubeField,
  Template,
  TemplateElement,
  TemplateField,
  TemporalField,
  TextArea,
  TextField,
} from 'cedar-model-typescript-library';
import { CedarComponent } from '../models/component/cedar-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { ElementComponent } from '../models/component/element-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { StaticFieldComponent } from '../models/static/static-field-component.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { InputType } from '../models/input-type.model';
import { LabelInfo } from '../models/info/label-info.model';
import { HandlerContext } from '../util/handler-context';
import { TemplateParser } from './template-parser';
import { InstanceObject } from '../models/instance-node.model';
import { MultiComponent } from '../models/component/multi-component.model';

/**
 * The reader's code for an `_ui.order` entry with no matching property. It is
 * the one blueprint finding that costs the user something they can see.
 */
const ORPHAN_ORDER_ENTRY = 'jtr07';

/**
 * Which kind of field the model says this is.
 *
 * The library models a field's constraints on a per-kind interface —
 * `NumericField.valueConstraints` is a `ValueConstraintsNumericField`, and the
 * base `ValueConstraints` every `TemplateField` declares is empty — so reading a
 * bound means first establishing which kind is in hand. These do that against
 * `cedarFieldType`, which is the same discriminant the reader itself branches on
 * when it decides which constraint object to build. A guard rather than a cast:
 * the check is real, and it is the one the model already trusts.
 *
 * This replaced holding `valueConstraints` as `any`, which typed every bound as
 * `any` and hid that the library returns an empty constraint object for the
 * email, link, phone-number and `ext-*` kinds — so a default value or a length
 * bound declared on one of those has never reached CEE.
 */
const isTextField = (field: TemplateField): field is TextField => field.cedarFieldType === CedarFieldType.TEXT;

const isTextArea = (field: TemplateField): field is TextArea => field.cedarFieldType === CedarFieldType.TEXTAREA;

const isNumericField = (field: TemplateField): field is NumericField => field.cedarFieldType === CedarFieldType.NUMERIC;

const isTemporalField = (field: TemplateField): field is TemporalField =>
  field.cedarFieldType === CedarFieldType.TEMPORAL;

const isBooleanField = (field: TemplateField): field is BooleanField => field.cedarFieldType === CedarFieldType.BOOLEAN;

const isControlledTermField = (field: TemplateField): field is ControlledTermField =>
  field.cedarFieldType === CedarFieldType.CONTROLLED_TERM;

const isCheckboxField = (field: TemplateField): field is CheckboxField =>
  field.cedarFieldType === CedarFieldType.CHECKBOX;

const isRadioField = (field: TemplateField): field is RadioField => field.cedarFieldType === CedarFieldType.RADIO;

/** Both list kinds, which differ in cardinality and share every constraint. */
const isListField = (field: TemplateField): field is SingleChoiceListField | MultipleChoiceListField =>
  field.cedarFieldType === CedarFieldType.SINGLE_SELECT_LIST ||
  field.cedarFieldType === CedarFieldType.MULTIPLE_SELECT_LIST;

const isYoutubeField = (field: TemplateField): field is StaticYoutubeField =>
  field.cedarFieldType === CedarFieldType.STATIC_YOUTUBE;

const isImageField = (field: TemplateField): field is StaticImageField =>
  field.cedarFieldType === CedarFieldType.STATIC_IMAGE;

const isRichTextField = (field: TemplateField): field is StaticRichTextField =>
  field.cedarFieldType === CedarFieldType.STATIC_RICH_TEXT;

/** A component that carries occurrence bounds, which both multi halves do. */
const isMultiComponent = (component: CedarComponent): component is MultiComponent =>
  component instanceof MultiFieldComponent || component instanceof MultiElementComponent;

/**
 * The four controlled-term constraint kinds, as one element type.
 *
 * Derived from the exported `ControlledTermField` rather than named directly:
 * the library exports the field interfaces and the builders, not the constraint
 * entities, and reaching into its file layout to name them would tie CEE to a
 * path rather than to the model.
 */
type ControlledConstraints = ControlledTermField['valueConstraints'];
type ControlledConstraintEntry =
  | ControlledConstraints['ontologies'][number]
  | ControlledConstraints['valueSets'][number]
  | ControlledConstraints['classes'][number]
  | ControlledConstraints['branches'][number];

/**
 * Builds CEE's component tree from the CEDAR Model TypeScript Library's parsed
 * model, instead of walking the template's JSON by hand.
 *
 * The library owns the CEDAR vocabulary and the rules for reading it — which
 * `_ui.inputType` values exist, where each type keeps its constraints, that a
 * field with ontologies is a controlled term, that `_ui.order` decides the
 * children and their sequence. `JsonWalkTemplateParser` re-implements all of
 * that against CEE's own copy of the key constants, which is how CEE came to
 * know four numeric types where the model has seven.
 *
 * Behaviourally this is required to match the walk. Where the two differ, the
 * difference is deliberate and listed below.
 *
 * **`multipleChoice` on a list field.** The walk copies
 * `_valueConstraints.multipleChoice` verbatim. The library normalises it
 * against the property's cardinality — a list whose answer selects several
 * options serialises as an array, so the schema is the half that governs the
 * instance — and both the Java artifact library and this one write it back
 * normalised. Six list fields across the shared corpora declare the two
 * inconsistently, and for those the widget changes: the array now decides. The
 * walk's answer disagrees with what either library would write for the same
 * template.
 *
 * **`_ui.temporalGranularity` on a non-temporal field.** The walk reads it for
 * any field; the library models it only on temporal ones, where it means
 * something. No template in the shared corpora carries it elsewhere.
 *
 * **Absent versus false.** The walk leaves `undefined` wherever a key is
 * missing; the library returns the type's zero — `false`, `null`, an empty
 * array. Nothing downstream distinguishes them, and this parser does not try
 * to reproduce the difference.
 */
export class ModelLibraryTemplateParser implements TemplateParser {
  /**
   * Read a template that arrived as JSON.
   *
   * The only part of this class that knows what a serialisation looks like.
   * Everything below works on the parsed model, which is why
   * `YamlTemplateParser` is four lines.
   */
  parse(templateJson: object, template: CedarTemplate, handlerContext: HandlerContext): void {
    const result = CedarReaders.json()
      .getFebruary2024()
      .getTemplateReader()
      // `JsonNode` is the library's name for a parsed JSON object, and differs
      // from `object` only in declaring the index signature that makes it one.
      .readFromObject(templateJson as JsonNode);

    ModelLibraryTemplateParser.report(result.parsingResult.getBlueprintComparisonErrors(), handlerContext);
    ModelLibraryTemplateParser.mapParsedTemplate(result.template, template);

    if (!template.isBasedOn) {
      // Every instance built from this template will have no `schema:isBasedOn`
      // and so will not say what it is an instance of. That is not something to
      // discover later from an unusable document.
      handlerContext.messageHandlerService.error(
        'Template has no @id, so instances of it cannot say which template they came from. ' +
          'This is a template that has never been saved.',
      );
    }
  }

  /**
   * Build CEE's component tree from a parsed template, whatever produced it.
   *
   * Nothing below this line mentions a format. A template read from YAML gives
   * the same `Template`, so it gives the same tree — which is the whole claim
   * that CEE no longer depends on JSON, and `format-independence.spec.ts`
   * checks it against all 37 corpus templates in both serialisations.
   */
  static mapParsedTemplate(parsed: Template, template: CedarTemplate): void {
    // Kept for the instance side: `InstanceInflater` completes an instance from
    // it, which is how the `@context` stops being CEE's to assemble.
    template.parsed = parsed;
    ModelLibraryTemplateParser.wrap(parsed, template, []);
    ModelLibraryTemplateParser.generateContext(parsed, template, true);

    template.labelInfo.label = parsed.schema_name;
    template.labelInfo.description = parsed.schema_description;
    template.isBasedOn = parsed.at_id.getValue();
  }

  /**
   * Turn the reader's blueprint findings into CEE's messages.
   *
   * The reader records every departure from the CEDAR blueprint and keeps
   * going, which is more than CEE wants to hear about. CEE is a renderer, not a
   * validator: a missing `propertyDescriptions` entry or an attribute-value
   * child with no `@context` IRI mapping — the two most common findings, and
   * the second is arguably the reader being over-strict — change nothing about
   * the form. Reporting all of them as errors buried the one that matters and
   * made every template with an attribute-value field look broken.
   *
   * So only `jtr07` is an error: `_ui.order` naming a child that `properties`
   * does not define means something the template asked for is not on the
   * screen. The rest are traced.
   */
  private static report(errors: ComparisonError[], handlerContext: HandlerContext): void {
    for (const error of errors) {
      if (error.errorLocation === ORPHAN_ORDER_ENTRY) {
        handlerContext.messageHandlerService.error(
          `Template lists "${error.encounteredValue}" in _ui.order but has no such property. Skipping it.`,
        );
      } else {
        handlerContext.messageHandlerService.trace(
          `Template departs from the CEDAR blueprint at ${JSON.stringify(error.errorPath)} (${error.errorLocation}).`,
        );
      }
    }
  }

  private static wrap(container: AbstractContainerArtifact, component: ElementComponent, parentPath: string[]): void {
    for (const childInfo of container.getChildrenInfo().children) {
      const name = childInfo.name;
      const child = container.getChild(name);
      if (child === null) {
        continue;
      }

      const isMulti = childInfo.isMultiInAnyWay();
      const myPath: string[] = parentPath.slice();
      myPath.push(name);

      let r: CedarComponent | null = null;

      if (childInfo.atType === CedarArtifactType.TEMPLATE_FIELD) {
        const field = child as TemplateField;
        r = isMulti ? new MultiFieldComponent() : new SingleFieldComponent();
        ModelLibraryTemplateParser.extractValueConstraints(
          field,
          childInfo as ChildDeploymentInfo,
          r as FieldComponent,
        );
        ModelLibraryTemplateParser.extractLabels(field, childInfo, name, r as FieldComponent);
      } else if (childInfo.atType === CedarArtifactType.TEMPLATE_ELEMENT) {
        const element = child as TemplateElement;
        r = isMulti ? new MultiElementComponent() : new SingleElementComponent();
        ModelLibraryTemplateParser.extractLabels(element, childInfo, name, r as FieldComponent);
        ModelLibraryTemplateParser.wrap(element, r as ElementComponent, myPath);
        ModelLibraryTemplateParser.generateContext(element, r as AbstractElementComponent, false);
      } else if (childInfo.atType === CedarArtifactType.STATIC_TEMPLATE_FIELD) {
        const staticField = child as TemplateField;
        const sfc = new StaticFieldComponent();
        sfc.basicInfo.inputType = childInfo.uiInputType.getValue();
        // YouTube calls this value `videoId`; image and rich text call it
        // `content`; a page or section break has neither. They share no
        // interface exposing any of it, so which kind this is decides which
        // property exists to read.
        if (isYoutubeField(staticField)) {
          sfc.contentInfo.content = staticField.videoId ?? '';
          // `_ui._size`. Both sizeable kinds carry it now — the model library
          // used to model `width`/`height` on `StaticYoutubeField` alone, so an
          // image's size was gone before it reached here.
          sfc.contentInfo.width = staticField.width ?? null;
          sfc.contentInfo.height = staticField.height ?? null;
        } else if (isImageField(staticField)) {
          sfc.contentInfo.content = staticField.content ?? '';
          sfc.contentInfo.width = staticField.width ?? null;
          sfc.contentInfo.height = staticField.height ?? null;
        } else if (isRichTextField(staticField)) {
          sfc.contentInfo.content = staticField.content ?? '';
        }
        ModelLibraryTemplateParser.extractLabels(staticField, childInfo, name, sfc);
        r = sfc;
      }

      if (r === null) {
        continue;
      }

      if (isMulti && isMultiComponent(r)) {
        // Every dynamic child answers these. For a checkbox, a multiple-choice
        // list or an attribute-value field the template usually leaves them out
        // and the model derives them from `requiredValue` — the same rule the
        // JSON writer applies, so what CEE reads matches what a round-trip
        // would emit.
        const multiInfo = childInfo as AbstractDynamicChildDeploymentInfo;
        r.multiInfo.minItems = multiInfo.minItems ?? null;
        r.multiInfo.maxItems = multiInfo.maxItems ?? null;
      }

      // A child the template marks `_ui.hidden` is kept and flagged, not
      // dropped. Hiding is a display decision: the template still declares the
      // property and may still require it, so the instance needs a slot for it
      // whether or not anyone can see it. Dropping the child meant the instance
      // builder never learned about it and the document came out missing a
      // property its own schema demanded — three of the six non-conformant
      // corpus templates failed for exactly that.
      //
      // The renderer already skips a component whose `hidden` is set, so
      // marking it is enough to keep it off the screen.
      r.hiddenInTemplate = childInfo.hidden === true;
      r.hidden = r.hiddenInTemplate;
      component.children.push(r);
      r.name = name;
      r.path = myPath;
    }
  }

  /**
   * Generate the container's `@context` block rather than copying it.
   *
   * The standard prefixes and typed entries are fixed by the CEDAR model, and
   * the library states them once; the child IRIs come from the same mapping the
   * library uses when it writes a template, which takes each child's declared
   * IRI and mints one where a template omits it.
   *
   * Generating drops whatever a template happens to carry that is not one of
   * those things. Across the 94 templates in the shared corpora that is two
   * entries, both in `template-003`, which is the deliberately malformed one: a
   * prefix named `rdfs--` and an IRI for a property the template never defines.
   * It also adds the entry that template is missing for a child it *does*
   * define, and drops the one `template-022` carries for an attribute-value
   * field — a field whose name is not a property of the instance, and whose
   * entry CEE deletes anyway the moment the user names an attribute.
   *
   * Every other container comes out identical.
   */
  private static generateContext(
    container: AbstractContainerArtifact,
    component: AbstractElementComponent,
    isRoot: boolean,
  ): void {
    // Only the instance root declares the prefixes; a nested element's
    // `@context` is its child IRIs and nothing else, because the prefixes are
    // already in scope. Repeating them would bloat every occurrence of every
    // element and match nothing CEDAR writes.
    const entries: Record<string, string> = isRoot
      ? Object.fromEntries(
          Object.entries(JsonTemplateInstanceContent.CONTEXT_VERBATIM).map(([key, value]) => [key, String(value)]),
        )
      : {};
    // `getChildIriMap` rather than `getIRIMap`: the latter returns the shape
    // JSON Schema wants — `{ name: { enum: [iri] } }` — and reading an IRI out
    // of it meant reaching through `[JsonSchema.enum][0]`, which was the last
    // raw key lookup left anywhere in CEE's template read path. Asking the model
    // for the mapping is the whole point of asking the model.
    const iriMap = container.getChildrenInfo().getChildIriMap();
    for (const name of Object.keys(iriMap)) {
      entries[name] = String(iriMap[name]);
    }
    component.contextEntries = entries;
  }

  private static extractValueConstraints(
    field: TemplateField,
    childInfo: ChildDeploymentInfo,
    fc: FieldComponent,
  ): void {
    const fieldType = field.cedarFieldType;
    // `controlled` is CEE's own pseudo-type: the template says `textfield`, and
    // the presence of ontologies, classes, branches or value sets is what makes
    // it a controlled term. The library decides the same way and records the
    // answer in `cedarFieldType`.
    fc.basicInfo.inputType =
      fieldType === CedarFieldType.CONTROLLED_TERM ? InputType.controlled : fieldType.getUiInputType().getValue();

    // `requiredValue` lives in the field's own `_valueConstraints`, but the
    // library resolves it onto the child's deployment info rather than the
    // parsed field.
    fc.valueInfo.requiredValue = childInfo.requiredValue;

    if (isTemporalField(field)) {
      fc.basicInfo.timezoneEnabled = field.timezoneEnabled === true;
      fc.basicInfo.inputTimeFormat = field.inputTimeFormat.getValue();
      fc.basicInfo.temporalGranularity = field.temporalGranularity.getValue();
      fc.valueInfo.temporalType = field.valueConstraints.temporalType.getValue();
    }

    /*
     * `?? null` throughout, because a constraint the template omits is simply not
     * on the object the library built. The info models say null for an undeclared
     * bound, so the conversion belongs here — at the one place that reads the
     * model — rather than in each of the nine widgets and validators that go on to
     * ask what the bound is.
     *
     * Each read sits under the guard for the kind that declares it. That is not a
     * narrowing of what CEE reads: the four kinds below are the only ones the
     * library gives a constraint object carrying these at all.
     */
    if (isTextField(field) || isTextArea(field) || isListField(field) || isBooleanField(field)) {
      fc.valueInfo.defaultValue = field.valueConstraints.defaultValue ?? null;
    }

    if (isTextField(field)) {
      fc.valueInfo.minLength = field.valueConstraints.minLength ?? null;
      fc.valueInfo.maxLength = field.valueConstraints.maxLength ?? null;
      fc.valueInfo.regex = field.valueConstraints.regex ?? null;
    }

    if (isNumericField(field)) {
      fc.numberInfo.numberType = field.valueConstraints.numberType.getValue();
      fc.numberInfo.unitOfMeasure = field.valueConstraints.unitOfMeasure ?? null;
      fc.numberInfo.minValue = field.valueConstraints.minValue ?? null;
      fc.numberInfo.maxValue = field.valueConstraints.maxValue ?? null;
      // The model spells it `decimalPlaces`; CEE's ValueInfo spells it
      // `decimalPlace`, matching the JSON key.
      fc.numberInfo.decimalPlace = field.valueConstraints.decimalPlaces ?? null;
    }

    if (isCheckboxField(field) || isRadioField(field) || isListField(field)) {
      for (const literal of field.valueConstraints.literals) {
        fc.choiceInfo.choices.push(new ChoiceOption(literal.label ?? '', literal.selectedByDefault === true));
      }
    }

    // Only list fields carry it, and only the select widget reads it.
    fc.choiceInfo.multipleChoice = isListField(field) && field.multipleChoice === true;

    if (isControlledTermField(field)) {
      ModelLibraryTemplateParser.extractControlledInfo(field.valueConstraints, fc);
    }
  }

  /**
   * Rebuild the controlled-term constraints as plain JSON.
   *
   * `ControlledFieldDataService` forwards these verbatim to CEDAR's terminology
   * search endpoint, so what matters is that the objects match the template's
   * own, key for key. The library's value-constraint writers are used rather
   * than hand-copying fields: they are the code that reproduces the source
   * JSON, so they get the optional keys right — `numTerms`, for one, is present
   * on only some ontologies, and inventing `numTerms: null` for the rest would
   * change the request body.
   */
  private static extractControlledInfo(vc: ControlledConstraints, fc: FieldComponent): void {
    const writers = CedarWriters.json().getStrict();
    const asJson = (list: readonly ControlledConstraintEntry[]): object[] =>
      list.map((entry) => writers.getWriterForValueConstraint(entry).getAsJsonNode(entry));

    fc.controlledInfo.ontologies = asJson(vc.ontologies);
    fc.controlledInfo.valueSets = asJson(vc.valueSets);
    fc.controlledInfo.classes = asJson(vc.classes);
    fc.controlledInfo.branches = asJson(vc.branches);

    if (vc.defaultValue != null) {
      fc.valueInfo.defaultValue = {
        iri: vc.defaultValue.termUri.getValue(),
        label: vc.defaultValue.rdfsLabel,
      };
    } else {
      // Null, not undefined: a field with no declared default holds nothing, and
      // `ValueInfo.defaultValue` says `string | boolean | AuthorityTerm | null`.
      fc.valueInfo.defaultValue = null;
    }
  }

  /**
   * CEE's label rules, unchanged.
   *
   * The artifact's own `schema:name` wins unless it is missing or merely
   * repeats the property key — CEDAR usually sets the two the same — in which
   * case the parent's `_ui.propertyLabels` entry is used. Descriptions work the
   * same way, with the literal string `Help Text` treated as absent because
   * that is what the Template Editor writes when the author left it blank.
   *
   * The library has already resolved the parent's maps onto the child info, so
   * `childInfo.label` and `childInfo.description` are those entries. It reports
   * null where the walk would leave the value untouched, so a null is taken to
   * mean "no entry" and the artifact's own value stands.
   */
  private static extractLabels(
    artifact: TemplateField | TemplateElement,
    childInfo: AbstractChildDeploymentInfo,
    name: string,
    fc: { labelInfo: LabelInfo },
  ): void {
    fc.labelInfo.preferredLabel = artifact.skos_prefLabel ?? null;
    fc.labelInfo.description = artifact.schema_description;
    fc.labelInfo.label = artifact.schema_name;

    if (fc.labelInfo.description == null || fc.labelInfo.description === 'Help Text') {
      if (childInfo.description != null) {
        fc.labelInfo.description = childInfo.description;
      }
    }
    if (fc.labelInfo.label == null || fc.labelInfo.label === name) {
      if (childInfo.label != null) {
        fc.labelInfo.label = childInfo.label;
      }
    }
  }
}
