// @vitest-environment jsdom
import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputAttributeValueComponent } from './cedar-input-attribute-value.component';

describe('CedarInputAttributeValueComponent', () => {
  afterEach(() => document.body.replaceChildren());
  const makeComponent = (): CedarInputAttributeValueComponent => {
    const registry = new ActiveComponentRegistryService();
    const injector = Injector.create({
      providers: [
        { provide: ActiveComponentRegistryService, useValue: registry },
        { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
        { provide: ChangeDetectorRef, useValue: { markForCheck: (): void => undefined } },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputAttributeValueComponent(new FormBuilder(), registry),
    );
    component.handlerContext = { validation: { draftFor: () => null } } as never;
    return component;
  };

  for (const labelTop of [80, 120]) {
    it(`reveals a label clipped by a scrolling embed across a shadow boundary: ${labelTop < 100}`, () => {
      const scroll = document.createElement('div');
      document.body.append(scroll);
      scroll.style.overflowY = 'auto';
      scroll.getBoundingClientRect = () => ({ top: 100, bottom: 400 }) as DOMRect;
      Object.defineProperty(scroll, 'clientHeight', { value: 300 });
      const host = document.createElement('div');
      scroll.append(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const pair = document.createElement('form');
      const label = document.createElement('mat-label');
      pair.append(label);
      shadow.append(pair);
      // The inputs themselves fit. Only the floating label may be outside the host viewport.
      pair.getBoundingClientRect = () => ({ top: 140, bottom: 200 }) as DOMRect;
      label.getBoundingClientRect = () => ({ top: labelTop, bottom: labelTop + 16 }) as DOMRect;
      pair.scrollIntoView = vi.fn();

      makeComponent().revealFocusedPair(pair);

      if (labelTop < 100) expect(pair.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
      else expect(pair.scrollIntoView).not.toHaveBeenCalled();
    });
  }

  it('reveals a pair outside the browser viewport even without a scrolling embed', () => {
    const pair = document.createElement('form');
    pair.getBoundingClientRect = () => ({ top: -10, bottom: 50 }) as DOMRect;
    pair.scrollIntoView = vi.fn();

    makeComponent().revealFocusedPair(pair);

    expect(pair.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('does not publish attempted typing or blur changes while read-only', () => {
    const component = makeComponent();
    component.setCurrentValue({ colour: 'blue' });
    component.readOnlyMode = true;
    const change = vi.fn();
    component.handlerContext.changeAttributeValue = change;

    component.nameChanged({ target: { value: 'replacement' } } as unknown as Event);
    component.valueChanged({ target: { value: 'replacement' } } as unknown as Event);

    expect(change).not.toHaveBeenCalled();
    expect(component.nameInputControl.value).toBe('colour');
    expect(component.valueInputControl.value).toBe('blue');
  });

  it('accepts the name/value view object pushed by the active-component registry', () => {
    const component = makeComponent();

    component.setCurrentValue({ colour: 'blue' });

    expect(component.nameInputControl.value).toBe('colour');
    expect(component.valueInputControl.value).toBe('blue');
  });

  it('keeps a name whose value is not filled yet', () => {
    const component = makeComponent();

    component.setCurrentValue({ colour: null });

    expect(component.nameInputControl.value).toBe('colour');
    expect(component.valueInputControl.value).toBeNull();
  });

  it('clears the controls for a payload that is not one attribute', () => {
    const component = makeComponent();
    component.nameInputControl.setValue('old');
    component.valueInputControl.setValue('value');

    component.setCurrentValue({ colour: 'blue', size: 'large' });

    expect(component.nameInputControl.value).toBeNull();
    expect(component.valueInputControl.value).toBeNull();
  });

  it('clears a stale attribute-name error when the model supplies a valid value', () => {
    const component = makeComponent();
    component.attributeNameError = { key: 'Validation.Attribute.NameInUse', params: { name: 'colour' } };
    component.nameInputControl.setErrors({ attributeName: true });

    component.setCurrentValue({ colour: 'blue' });

    expect(component.attributeNameError).toBeNull();
    expect(component.nameInputControl.errors).toBeNull();
  });

  it('restores a rejected name draft instead of overwriting it with the last accepted value', () => {
    const component = makeComponent();
    const error = { key: 'Validation.Attribute.NameInUse', params: { name: 'size' } };
    component.handlerContext = {
      validation: { draftFor: () => ({ code: 'attributeName', state: { key: 'size', value: 'large', error } }) },
    } as never;

    component.setCurrentValue({ colour: 'blue' });

    expect(component.nameInputControl.value).toBe('size');
    expect(component.valueInputControl.value).toBe('large');
    expect(component.attributeNameError).toEqual(error);
    expect(component.nameInputControl.errors).toEqual({ attributeName: true });
  });

  it('clears a rejected name and its value when the occurrence is deleted', () => {
    const component = makeComponent();
    component.setCurrentValue({ colour: 'blue' });
    component.attributeNameError = { key: 'Validation.Attribute.NameInUse', params: { name: 'colour' } };
    component.nameInputControl.setErrors({ attributeName: true });

    component.deleteCurrentValue();

    expect(component.nameInputControl.value).toBeNull();
    expect(component.valueInputControl.value).toBeNull();
    expect(component.attributeNameError).toBeNull();
    expect(component.nameInputControl.errors).toBeNull();
  });
});
