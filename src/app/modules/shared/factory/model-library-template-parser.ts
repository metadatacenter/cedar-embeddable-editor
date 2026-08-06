import {
  AbstractContainerArtifact,
  AbstractDynamicChildDeploymentInfo,
  CedarArtifactType,
  CedarFieldType,
  CedarReaders,
  CedarWriters,
  JsonTemplateInstanceContent,
  ChildDeploymentInfo,
  Template,
  TemplateElement,
  TemplateField,
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

/**
 * The reader's code for an `_ui.order` entry with no matching property. It is
 * the one blueprint finding that costs the user something they can see.
 */
const ORPHAN_ORDER_ENTRY = 'jtr07';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .readFromObject(templateJson as any);

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
  private static report(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errors: any[],
    handlerContext: HandlerContext,
  ): void {
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

      let r: CedarComponent = null;

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
        const sfc = new StaticFieldComponent();
        sfc.basicInfo.inputType = childInfo.uiInputType.getValue();
        // YouTube calls this value `videoId`; the other static content types
        // call it `content`. They have no shared interface exposing either.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const staticField = child as any;
        sfc.contentInfo.content =
          sfc.basicInfo.inputType === InputType.youtube ? staticField.videoId : staticField.content;
        ModelLibraryTemplateParser.extractLabels(child as TemplateField, childInfo, name, sfc);
        r = sfc;
      }

      if (r === null) {
        continue;
      }

      if (isMulti) {
        // Every dynamic child answers these. For a checkbox, a multiple-choice
        // list or an attribute-value field the template usually leaves them out
        // and the model derives them from `requiredValue` — the same rule the
        // JSON writer applies, so what CEE reads matches what a round-trip
        // would emit.
        const multiInfo = childInfo as AbstractDynamicChildDeploymentInfo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r as any).multiInfo.minItems = multiInfo.minItems;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r as any).multiInfo.maxItems = multiInfo.maxItems;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flaggable = r as any;
      flaggable.hiddenInTemplate = childInfo.hidden === true;
      flaggable.hidden = flaggable.hiddenInTemplate;
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
    const entries: Record<string, unknown> = isRoot ? { ...JsonTemplateInstanceContent.CONTEXT_VERBATIM } : {};
    // `getChildIriMap` rather than `getIRIMap`: the latter returns the shape
    // JSON Schema wants — `{ name: { enum: [iri] } }` — and reading an IRI out
    // of it meant reaching through `[JsonSchema.enum][0]`, which was the last
    // raw key lookup left anywhere in CEE's template read path. Asking the model
    // for the mapping is the whole point of asking the model.
    const iriMap = container.getChildrenInfo().getChildIriMap();
    for (const name of Object.keys(iriMap)) {
      entries[name] = iriMap[name];
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vc = field.valueConstraints as any;

    if (fieldType === CedarFieldType.TEMPORAL) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const temporal = field as any;
      fc.basicInfo.timezoneEnabled = temporal.timezoneEnabled;
      fc.basicInfo.inputTimeFormat = temporal.inputTimeFormat?.getValue();
      fc.basicInfo.temporalGranularity = temporal.temporalGranularity?.getValue();
      fc.valueInfo.temporalType = vc?.temporalType?.getValue();
    }

    if (vc == null) {
      return;
    }

    fc.valueInfo.defaultValue = vc.defaultValue;
    fc.valueInfo.minLength = vc.minLength;
    fc.valueInfo.maxLength = vc.maxLength;
    fc.valueInfo.regex = vc.regex;

    if (fieldType === CedarFieldType.NUMERIC) {
      fc.numberInfo.numberType = vc.numberType?.getValue();
      fc.numberInfo.unitOfMeasure = vc.unitOfMeasure;
      fc.numberInfo.minValue = vc.minValue;
      fc.numberInfo.maxValue = vc.maxValue;
      // The model spells it `decimalPlaces`; CEE's ValueInfo spells it
      // `decimalPlace`, matching the JSON key.
      fc.numberInfo.decimalPlace = vc.decimalPlaces;
    }

    if (Array.isArray(vc.literals)) {
      for (const literal of vc.literals) {
        const option = new ChoiceOption();
        option.label = literal.label;
        option.selectedByDefault = literal.selectedByDefault;
        fc.choiceInfo.choices.push(option);
      }
    }
    // Only list fields carry it, and only the select widget reads it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.choiceInfo.multipleChoice = (field as any).multipleChoice;

    if (fieldType === CedarFieldType.CONTROLLED_TERM) {
      ModelLibraryTemplateParser.extractControlledInfo(vc, fc);
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
  private static extractControlledInfo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vc: any,
    fc: FieldComponent,
  ): void {
    const writers = CedarWriters.json().getStrict();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asJson = (list: any[]): object[] =>
      (list ?? []).map((entry) => writers.getWriterForValueConstraint(entry).getAsJsonNode(entry));

    fc.controlledInfo.ontologies = asJson(vc.ontologies);
    fc.controlledInfo.valueSets = asJson(vc.valueSets);
    fc.controlledInfo.classes = asJson(vc.classes);
    fc.controlledInfo.branches = asJson(vc.branches);

    if (vc.defaultValue != null) {
      fc.valueInfo.defaultValue = {
        'rdfs:label': vc.defaultValue.rdfsLabel,
        termUri: vc.defaultValue.termUri?.getValue(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    } else {
      fc.valueInfo.defaultValue = undefined;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    childInfo: any,
    name: string,
    fc: { labelInfo: LabelInfo },
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.labelInfo.preferredLabel = (artifact as any).skos_prefLabel;
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
