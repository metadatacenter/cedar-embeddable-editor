import {
  TextPolicy,
  FieldValuePolicy,
  ValidationField,
  JsonTemplateInstanceWriter,
  InstanceDataEmptyAtom,
  InstanceDataEmptyNode,
  InstanceDataContainer,
  InstanceDataLabelAtom,
  InstanceDataAttributeValueFieldName,
} from 'cedar-model-typescript-library';
import { validAbsoluteFieldIri } from './absolute-iri';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { valueIsIri } from '../models/ext-auth-categories.model';
import { ValidationCode, ValidationProblem } from './validation-problem.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { InstanceNode } from '../models/instance-node.model';

/** Adapter from rendered components/occurrence nodes to the shared local validation rules. */
export class FieldValueValidator {
  private static field(component: FieldComponent, plainValue = false): ValidationField {
    return {
      _ui: {
        // The report extracts the label for a controlled term. Its IRI is checked on the node.
        inputType:
          plainValue && component.basicInfo.inputType === InputType.controlled
            ? 'textfield'
            : (component.basicInfo.inputType ?? undefined),
        temporalGranularity: component.basicInfo.temporalGranularity,
        timezoneEnabled: component.basicInfo.timezoneEnabled,
      },
      _valueConstraints: Object.fromEntries(
        Object.entries({
          minLength: component.valueInfo.minLength,
          maxLength: component.valueInfo.maxLength,
          regex: component.valueInfo.regex,
          temporalType: component.valueInfo.temporalType,
          numberType: component.numberInfo?.numberType,
          minValue: component.numberInfo?.minValue,
          maxValue: component.numberInfo?.maxValue,
          decimalPlace: component.numberInfo?.decimalPlace,
          literals: component.choiceInfo?.choices,
        }).filter(([, value]) => value !== null && value !== undefined),
      ),
    };
  }

  static validate(component: FieldComponent, value: unknown, path: string[]): ValidationProblem[] {
    if (Array.isArray(value)) return value.flatMap((entry) => this.validate(component, entry, path));
    return FieldValuePolicy.validate(this.field(component, true), value).map((finding) =>
      this.problem(component, path, finding.code, finding.message, value),
    );
  }

  static validateConfiguration(component: FieldComponent): ValidationProblem[] {
    return FieldValuePolicy.validateConfiguration(this.field(component)).map((finding) =>
      this.problem(component, component.path, finding.code, finding.message, null),
    );
  }

  private static problem(
    component: FieldComponent,
    path: string[],
    code: string,
    message: string,
    value: unknown,
  ): ValidationProblem {
    return new ValidationProblem(
      path,
      path.length ? path[path.length - 1] : component.name,
      component.basicInfo.inputType,
      code,
      message,
      value,
    );
  }

  /** Check the stored node before extracting a plain value, which can hide malformed input. */
  static validateNode(component: FieldComponent, node: InstanceNode, path: string[]): ValidationProblem[] {
    if (node instanceof InstanceDataEmptyNode) return [];
    if (node instanceof InstanceDataEmptyAtom) {
      return node.hasDiscardedContent()
        ? [
            this.problem(
              component,
              path,
              ValidationCode.valueShape,
              'The supplied value has no usable literal or IRI.',
              node.discarded,
            ),
          ]
        : FieldValuePolicy.validateNode(this.field(component), {})
            .filter((finding) => finding.category === 'structural')
            .map((finding) => this.problem(component, path, finding.code, finding.message, {}));
    }
    if (
      component.basicInfo.inputType === InputType.attributeValue &&
      node instanceof InstanceDataAttributeValueFieldName
    ) {
      return TextPolicy.isBlank(node.name)
        ? [
            new ValidationProblem(
              path,
              component.name,
              component.basicInfo.inputType,
              // An unnamed editor row is omitted by the writer. Raw stored blank
              // names are still structural findings retained from the reader.
              ValidationCode.required,
              'An attribute needs a name.',
              node.name,
              [],
            ),
          ]
        : [];
    }
    const iriField =
      component.basicInfo.inputType === InputType.controlled || valueIsIri(component.basicInfo.inputType as InputType);
    if (component.basicInfo.inputType === InputType.controlled && node instanceof InstanceDataLabelAtom)
      return this.validateControlledNode(component, node, path);
    if (
      node instanceof InstanceDataContainer ||
      (iriField ? !InstanceValueNode.isIriBearing(node) : !InstanceValueNode.isLiteral(node))
    ) {
      // A null literal is also a legacy spelling of an empty IRI slot.
      if (InstanceValueNode.isLiteral(node) && InstanceValueNode.literal(node) == null) return [];
      return [
        this.problem(
          component,
          path,
          ValidationCode.valueShape,
          iriField ? 'This field requires an IRI value.' : 'This field requires a literal value.',
          node instanceof InstanceDataContainer ? null : JsonTemplateInstanceWriter.writeValueNode(node),
        ),
      ];
    }
    if (
      InstanceValueNode.isIriBearing(node) &&
      !InstanceValueNode.iri(node) &&
      component.basicInfo.inputType !== InputType.controlled
    ) {
      return [this.problem(component, path, ValidationCode.iriMalformed, 'The stored IRI is empty.', null)];
    }
    const typed = FieldValuePolicy.validateNode(this.field(component), JsonTemplateInstanceWriter.writeValueNode(node))
      .filter((finding) => finding.code === 'valueType' || finding.code === 'missingProperty')
      .map((finding) =>
        this.problem(component, path, finding.code, finding.message, JsonTemplateInstanceWriter.writeValueNode(node)),
      );
    return [...typed, ...this.validateControlledNode(component, node, path)];
  }

  /**
   * Structural checks on a controlled-term node.
   *
   * Takes the raw node rather than the extracted value, because the point is
   * the shape: a populated controlled term carries an `@id`; its label is optional
   * unless the raw schema explicitly requires it. Whether the term is a member of the declared ontologies, value
   * sets, classes or branches cannot be answered without the terminology
   * server and is deliberately not attempted.
   */
  static validateControlledNode(component: FieldComponent, node: InstanceNode, path: string[]): ValidationProblem[] {
    if (component.basicInfo.inputType !== InputType.controlled) {
      return [];
    }
    // Read the id and label through the value-node model, so this validator sees
    // a controlled term the same way everything else in CEE does. A node the
    // model does not read as an id/label pair is not a controlled value to it,
    // and is left alone here too — which is what the two reads below answer.
    //
    // There was a container guard here, from when every node was a plain object
    // and a value was one too. A value is an atom, so the guard rejected every
    // node this validator exists to look at.
    const id = InstanceValueNode.iri(node);
    const label = InstanceValueNode.label(node);
    const hasId = typeof id === 'string' && id !== '';
    const hasLabel = typeof label === 'string' && label !== '';

    if (!hasId && !hasLabel) {
      return [];
    }
    const out: ValidationProblem[] = [];
    if (hasLabel && !hasId) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.controlledStructure,
          'Has rdfs:label but no @id.',
          // The library writes the node, rather than the node being handed over
          // as it stands. A problem's `value` is published contract, and an atom
          // serialises by its private fields — so what a host read here was
          // `{"_id": "…"}`, CEE's own spelling of `@id`. `writeValueNode` is
          // public for exactly this: the library's doc for it says a consumer
          // that spells the shapes by hand drifts from the end that reads them.
          JsonTemplateInstanceWriter.writeValueNode(node),
        ),
      );
    }
    if (hasId && !validAbsoluteFieldIri(id as string)) {
      out.push(this.problem(component, path, ValidationCode.iriMalformed, '@id is not a valid IRI.', id));
    }
    return out;
  }
}
