import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputAttributeValueComponent } from './cedar-input-attribute-value.component';

describe('CedarInputAttributeValueComponent', () => {
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
