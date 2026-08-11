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
    return runInInjectionContext(injector, () => new CedarInputAttributeValueComponent(new FormBuilder(), registry));
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
});
