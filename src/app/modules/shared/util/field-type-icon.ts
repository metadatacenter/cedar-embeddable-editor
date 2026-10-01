import { InputType } from '../models/input-type.model';

/** The icon that names each field type, wherever a field's type is shown. */
const FIELD_TYPE_ICONS: Readonly<Record<string, string>> = {
  [InputType.orcid]: 'authority-person',
  [InputType.ror]: 'authority-organization',
  [InputType.pfas]: 'authority-chemical',
  [InputType.pmid]: 'authority-publication',
  [InputType.rrid]: 'authority-resource',
  [InputType.nihGrant]: 'authority-grant',
  [InputType.doi]: 'authority-doi',

  [InputType.numeric]: 'field-number',
  [InputType.text]: 'field-text',
  [InputType.textarea]: 'field-paragraph',
  [InputType.richText]: 'field-rich-text',
  [InputType.controlled]: 'field-controlled',
  [InputType.email]: 'field-email',
  [InputType.link]: 'field-link',
  [InputType.phoneNumber]: 'field-phone',
  [InputType.list]: 'field-list',
  [InputType.checkbox]: 'field-checkbox',
  [InputType.radio]: 'field-radio',
  [InputType.temporal]: 'field-date',
  [InputType.image]: 'field-image',
  [InputType.youtube]: 'field-video',
  [InputType.sectionBreak]: 'field-section-break',
  [InputType.pageBreak]: 'field-page-break',
  [InputType.attributeValue]: 'field-attribute-value',
};

/** The icon naming a field's input type. A type without an icon of its own takes the generic field icon. */
export function fieldTypeIcon(inputType: string): string {
  return FIELD_TYPE_ICONS[inputType] ?? 'artifact-field';
}
