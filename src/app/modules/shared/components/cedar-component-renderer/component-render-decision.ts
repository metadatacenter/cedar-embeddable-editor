import { CedarComponent } from '../../models/component/cedar-component.model';
import { ElementComponent } from '../../models/component/element-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { SingleElementComponent } from '../../models/element/single-element-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { InputType } from '../../models/input-type.model';
import { NullComponent } from '../../models/component/null-component.model';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { NullTemplate } from '../../models/template/null-template.model';

export type FieldRendererKind =
  | 'numeric'
  | 'text'
  | 'controlled'
  | 'email'
  | 'checkbox'
  | 'select'
  | 'attribute-value'
  | 'multiple-choice'
  | 'datetime'
  | 'link'
  | 'orcid'
  | 'ror'
  | 'pfas'
  | 'pmid'
  | 'rrid'
  | 'nih-grant'
  | 'doi'
  | 'phone';

export type StaticRendererKind = 'section-break' | 'image' | 'youtube' | 'rich-text' | 'page-break';

interface InputRendererRoute<RendererKind extends string> {
  inputType: string;
  renderer: RendererKind;
}

/**
 * The complete field-widget routing table.
 *
 * It is exported so one table-driven test can prove that a newly introduced input
 * type has been deliberately routed. The renderer itself reads the same table, so
 * the test cannot drift away from the production decision.
 */
export const FIELD_RENDERER_ROUTES = [
  { inputType: InputType.numeric, renderer: 'numeric' },
  { inputType: InputType.text, renderer: 'text' },
  { inputType: InputType.textarea, renderer: 'text' },
  { inputType: InputType.controlled, renderer: 'controlled' },
  { inputType: InputType.email, renderer: 'email' },
  { inputType: InputType.checkbox, renderer: 'checkbox' },
  { inputType: InputType.list, renderer: 'select' },
  { inputType: InputType.attributeValue, renderer: 'attribute-value' },
  { inputType: InputType.radio, renderer: 'multiple-choice' },
  { inputType: InputType.temporal, renderer: 'datetime' },
  { inputType: InputType.link, renderer: 'link' },
  { inputType: InputType.orcid, renderer: 'orcid' },
  { inputType: InputType.ror, renderer: 'ror' },
  { inputType: InputType.pfas, renderer: 'pfas' },
  { inputType: InputType.pmid, renderer: 'pmid' },
  { inputType: InputType.rrid, renderer: 'rrid' },
  { inputType: InputType.nihGrant, renderer: 'nih-grant' },
  { inputType: InputType.doi, renderer: 'doi' },
  { inputType: InputType.phoneNumber, renderer: 'phone' },
] as const satisfies readonly InputRendererRoute<FieldRendererKind>[];

/** Page breaks are consumed by the template paginator, but still routed explicitly. */
export const STATIC_RENDERER_ROUTES = [
  { inputType: InputType.sectionBreak, renderer: 'section-break' },
  { inputType: InputType.image, renderer: 'image' },
  { inputType: InputType.youtube, renderer: 'youtube' },
  { inputType: InputType.richText, renderer: 'rich-text' },
  { inputType: InputType.pageBreak, renderer: 'page-break' },
] as const satisfies readonly InputRendererRoute<StaticRendererKind>[];

const fieldRendererByInputType = new Map<string, FieldRendererKind>(
  FIELD_RENDERER_ROUTES.map(({ inputType, renderer }) => [inputType, renderer]),
);
const staticRendererByInputType = new Map<string, StaticRendererKind>(
  STATIC_RENDERER_ROUTES.map(({ inputType, renderer }) => [inputType, renderer]),
);

export type ComponentRenderDecision =
  | { kind: 'empty'; component: CedarComponent; reason: 'hidden' | 'placeholder' }
  | { kind: 'element'; component: ElementComponent; multiComponent: MultiElementComponent | null }
  | { kind: 'field'; component: FieldComponent; renderer: FieldRendererKind }
  | { kind: 'static'; component: StaticFieldComponent; renderer: StaticRendererKind }
  | { kind: 'unsupported'; component: CedarComponent; inputType: string | null; reason: string };

/**
 * Resolve exactly one rendering path for a model component.
 *
 * Keeping this pure makes the routing independently testable and makes replacing
 * a component atomic: the Angular component stores one decision instead of four
 * nullable fields that can retain state from the preceding input.
 */
export function decideComponentRender(component: CedarComponent): ComponentRenderDecision {
  if (component.hidden) {
    return { kind: 'empty', component, reason: 'hidden' };
  }
  if (component instanceof NullComponent || component instanceof NullTemplate) {
    return { kind: 'empty', component, reason: 'placeholder' };
  }
  if (component instanceof MultiElementComponent) {
    return { kind: 'element', component, multiComponent: component };
  }
  if (component instanceof SingleElementComponent || component instanceof CedarTemplate) {
    return { kind: 'element', component, multiComponent: null };
  }
  if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
    const renderer =
      component.basicInfo.inputType === null ? undefined : fieldRendererByInputType.get(component.basicInfo.inputType);
    return renderer === undefined
      ? unsupported(component, component.basicInfo.inputType, 'field input type')
      : { kind: 'field', component, renderer };
  }
  if (component instanceof StaticFieldComponent) {
    const renderer =
      component.basicInfo.inputType === null ? undefined : staticRendererByInputType.get(component.basicInfo.inputType);
    return renderer === undefined
      ? unsupported(component, component.basicInfo.inputType, 'static input type')
      : { kind: 'static', component, renderer };
  }
  return unsupported(component, null, 'component class');
}

function unsupported(component: CedarComponent, inputType: string | null, category: string): ComponentRenderDecision {
  const value = inputType === null ? component.className : `"${inputType}"`;
  return {
    kind: 'unsupported',
    component,
    inputType,
    reason: `No renderer is registered for ${category} ${value}.`,
  };
}
