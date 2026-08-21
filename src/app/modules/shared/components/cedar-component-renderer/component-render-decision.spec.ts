import { SimpleChange } from '@angular/core';
import { vi } from 'vitest';
import { CedarComponentRendererComponent } from './cedar-component-renderer.component';
import { decideComponentRender, FIELD_RENDERER_ROUTES, STATIC_RENDERER_ROUTES } from './component-render-decision';
import { NullComponent } from '../../models/component/null-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { SingleElementComponent } from '../../models/element/single-element-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { InputType } from '../../models/input-type.model';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { EmptyTemplate } from '../../models/template/empty-template.model';
import { HandlerContext } from '../../util/handler-context';

function field(inputType: string): SingleFieldComponent {
  const component = new SingleFieldComponent();
  component.basicInfo.inputType = inputType;
  return component;
}

function staticField(inputType: string): StaticFieldComponent {
  const component = new StaticFieldComponent();
  component.basicInfo.inputType = inputType;
  return component;
}

describe('component render decision', () => {
  it('accounts for every declared input type exactly once', () => {
    const routedInputTypes = [...FIELD_RENDERER_ROUTES, ...STATIC_RENDERER_ROUTES].map(({ inputType }) => inputType);
    const declaredInputTypes = Object.values(InputType) as string[];

    expect(new Set(routedInputTypes).size).toBe(routedInputTypes.length);
    expect([...routedInputTypes].sort()).toEqual([...declaredInputTypes].sort());
  });

  it.each(FIELD_RENDERER_ROUTES)('routes field input type $inputType to $renderer', ({ inputType, renderer }) => {
    expect(decideComponentRender(field(inputType))).toMatchObject({ kind: 'field', renderer });
  });

  it.each(STATIC_RENDERER_ROUTES)('routes static input type $inputType to $renderer', ({ inputType, renderer }) => {
    expect(decideComponentRender(staticField(inputType))).toMatchObject({ kind: 'static', renderer });
  });

  it('classifies every iterable model without a cross-interface cast', () => {
    const single = new SingleElementComponent();
    const multi = new MultiElementComponent();
    const template = new CedarTemplate();

    expect(decideComponentRender(single)).toEqual({ kind: 'element', component: single, multiComponent: null });
    expect(decideComponentRender(multi)).toEqual({ kind: 'element', component: multi, multiComponent: multi });
    expect(decideComponentRender(template)).toEqual({ kind: 'element', component: template, multiComponent: null });
  });

  it('makes hidden and placeholder models explicit empty decisions', () => {
    const hidden = field(InputType.text);
    hidden.hidden = true;
    const placeholder = new NullComponent();
    const emptyPage = new EmptyTemplate();

    expect(decideComponentRender(hidden)).toMatchObject({ kind: 'empty', reason: 'hidden' });
    expect(decideComponentRender(placeholder)).toMatchObject({ kind: 'empty', reason: 'placeholder' });
    expect(decideComponentRender(emptyPage)).toMatchObject({ kind: 'empty', reason: 'placeholder' });
  });

  it('returns a diagnostic decision for an unsupported field input type', () => {
    const component = field('future-widget');

    expect(decideComponentRender(component)).toEqual({
      kind: 'unsupported',
      component,
      inputType: 'future-widget',
      reason: 'No renderer is registered for field input type "future-widget".',
    });
  });

  it('reports an unsupported decision through the host diagnostic channel', () => {
    const renderer = new CedarComponentRendererComponent();
    const error = vi.fn();
    const component = field('future-widget');
    renderer.handlerContext = { messageHandlerService: { error } } as unknown as HandlerContext;

    renderer.componentToRender = component;
    renderer.ngOnChanges({ componentToRender: new SimpleChange(undefined, component, true) });

    expect(error).toHaveBeenCalledWith('No renderer is registered for field input type "future-widget".');
  });

  it('replaces the complete decision when Angular reuses a renderer', () => {
    const renderer = new CedarComponentRendererComponent();
    const staticComponent = staticField(InputType.image);
    const fieldComponent = new MultiFieldComponent();
    fieldComponent.basicInfo.inputType = InputType.text;

    renderer.componentToRender = staticComponent;
    expect(renderer.renderDecision).toEqual({ kind: 'static', component: staticComponent, renderer: 'image' });

    renderer.componentToRender = fieldComponent;
    expect(renderer.renderDecision).toEqual({ kind: 'field', component: fieldComponent, renderer: 'text' });
  });
});
