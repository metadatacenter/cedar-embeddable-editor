import * as _ from 'lodash-es';
import {
  InstanceDataAttributeValueFieldName,
  InstanceDataEmptyAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
} from 'cedar-model-typescript-library';
import { FieldComponent } from '../models/component/field-component.model';
import { InstanceNode } from '../models/instance-node.model';
import { InputType } from '../models/input-type.model';
import { DataQualityReportBuilderHandler } from '../handler/data-quality-report-builder.handler';
import { FieldValueValidator } from '../validation/field-value-validator';
import { CedarTemporalConfiguration, CedarTemporalValue } from './cedar-temporal-value';
import { DataObjectUtil } from './data-object-util';
import { InstanceValueNode } from './instance-value-node';

/**
 * One entry of an answer, as the field replacing the one it was entered in would
 * hold it, or null when that field cannot hold it without a new problem.
 *
 * Two candidates are tried in turn. The first is the entry exactly as it stands,
 * wherever it is already in the form the new field stores, so that an edit leaving
 * the field alone leaves the reader's entry alone too. The second restates it: a
 * literal keeps its text and takes the new field's datatype, a date is read at the
 * precision it was entered with and written at the new field's, and an entry the
 * reader emptied becomes the new field's empty slot, because clearing a default is
 * an answer as well. The first candidate in which `FieldValueValidator`, which the
 * form's own report is built from, finds no error the entry did not already have
 * where it was typed is the one kept. So the carrying never brings an error with it,
 * and an entry the reader has not finished making valid, say an address still
 * missing its domain, stays as it was while the template changes around it.
 *
 * A literal never becomes an IRI or the reverse, since neither can be read as the
 * other: text that looks like a web address is still text.
 */
export function carriedValue(before: FieldComponent, after: FieldComponent, answer: InstanceNode): InstanceNode | null {
  if (holdsAnswer(answer) && !hasTemporalParts(before, after)) return null;
  let already: Set<string> | null = null;
  for (const candidate of [unchanged(after, answer), restate(before, after, answer)]) {
    if (candidate === null) {
      continue;
    }
    already ??= new Set(errorsIn(before, answer));
    const known = already;
    if (errorsIn(after, candidate).every((code) => known.has(code))) {
      return candidate;
    }
  }
  return null;
}

/** Draft widget state can only be interpreted by a compatible input configuration. */
export function compatibleDraft(before: FieldComponent, after: FieldComponent): boolean {
  return (
    before.basicInfo.inputType === after.basicInfo.inputType &&
    (after.basicInfo.inputType !== InputType.temporal ||
      _.isEqual(temporalConfiguration(before), temporalConfiguration(after)))
  );
}

/** Storage padding is not information supplied by the reader. */
function hasTemporalParts(before: FieldComponent, after: FieldComponent): boolean {
  if (before.basicInfo.inputType !== InputType.temporal || after.basicInfo.inputType !== InputType.temporal)
    return true;
  const meaningful = (field: FieldComponent): Set<string> => {
    const parts = new Set<string>();
    const type = field.valueInfo.temporalType;
    const precision = field.basicInfo.temporalGranularity;
    const granularities = ['year', 'month', 'day', 'hour', 'minute', 'second', 'decimalSecond'];
    const last = granularities.indexOf(precision ?? '');
    if (type !== 'xsd:time') {
      for (const [index, part] of ['year', 'month', 'day'].entries()) if (index <= last) parts.add(part);
    }
    if (type !== 'xsd:date') {
      for (const [index, part] of ['hour', 'minute', 'second', 'decimalSecond'].entries())
        if (index + 3 <= last) parts.add(part);
    }
    return parts;
  };
  const supplied = meaningful(before);
  return [...meaningful(after)].every((part) => supplied.has(part));
}

/** Whether an entry holds anything: a value, or an attribute's name. */
export function holdsAnswer(node: InstanceNode): boolean {
  return node instanceof InstanceDataAttributeValueFieldName ? node.name !== '' : InstanceValueNode.holdsValue(node);
}

/** The entry as it stands, where it is already in the form the new field stores. */
function unchanged(after: FieldComponent, answer: InstanceNode): InstanceNode | null {
  const attribute = after.basicInfo.inputType === InputType.attributeValue;
  if (answer instanceof InstanceDataAttributeValueFieldName) {
    return attribute ? _.cloneDeep(answer) : null;
  }
  if (attribute) {
    return null;
  }
  if (InstanceValueNode.isIriBearing(answer) || answer instanceof InstanceDataEmptyAtom) {
    return DataObjectUtil.isIriValued(after) ? _.cloneDeep(answer) : null;
  }
  if (!InstanceValueNode.isLiteral(answer) || DataObjectUtil.isIriValued(after)) {
    return null;
  }
  const datatype = answer instanceof InstanceDataTypedAtom ? answer.type : null;
  return datatype === DataObjectUtil.xsdTypeForFullCopy(after) ? _.cloneDeep(answer) : null;
}

function restate(before: FieldComponent, after: FieldComponent, answer: InstanceNode): InstanceNode | null {
  if (!holdsAnswer(answer)) {
    return DataObjectUtil.getEmptyValueWrapper(after);
  }
  const attribute = after.basicInfo.inputType === InputType.attributeValue;
  if (answer instanceof InstanceDataAttributeValueFieldName || attribute) {
    return null;
  }
  if (InstanceValueNode.isIriBearing(answer)) {
    return DataObjectUtil.isIriValued(after) ? _.cloneDeep(answer) : null;
  }
  const text = InstanceValueNode.literal(answer);
  if (text === null || text === undefined || DataObjectUtil.isIriValued(after)) {
    return null;
  }
  const datatype = DataObjectUtil.xsdTypeForFullCopy(after);
  if (after.basicInfo.inputType === InputType.temporal) {
    const restated = restateTemporal(before, after, text);
    return restated === null ? null : InstanceValueNode.literalValue(restated, datatype);
  }
  const restated = InstanceValueNode.literalValue(text, datatype);
  // A language tag belongs to text; a typed literal cannot carry one.
  if (restated instanceof InstanceDataStringAtom && answer instanceof InstanceDataStringAtom) {
    restated.language = answer.language;
  }
  return restated;
}

/**
 * A date or time, read with the configuration it was entered under and written
 * with the new one, or null where it cannot be.
 *
 * Coarser precision keeps what it still records, as CEE does for a stored value
 * finer than its field: a day becomes its year. Finer precision, or another kind of
 * temporal value, needs parts the reader never gave. Text entered in another kind
 * of field is read as the new field reads it.
 */
function restateTemporal(before: FieldComponent, after: FieldComponent, text: string): string | null {
  const target = temporalConfiguration(after);
  const source = before.basicInfo.inputType === InputType.temporal ? temporalConfiguration(before) : target;
  const parts = CedarTemporalValue.parse(text, source);
  return parts === null ? null : CedarTemporalValue.serialize(parts, target);
}

function temporalConfiguration(field: FieldComponent): CedarTemporalConfiguration {
  return {
    temporalType: field.valueInfo.temporalType,
    granularity: field.basicInfo.temporalGranularity,
    timezoneEnabled: field.basicInfo.timezoneEnabled === true,
  };
}

/** The errors the field finds in this value, by kind, asked as the form's report asks. */
function errorsIn(field: FieldComponent, node: InstanceNode): string[] {
  const problems = [
    ...FieldValueValidator.validateNode(field, node, field.path),
    ...FieldValueValidator.validate(field, DataQualityReportBuilderHandler.extractPlainValue(node, field), field.path),
  ];
  return problems.filter((problem) => problem.severity === 'error').map((problem) => problem.code);
}
