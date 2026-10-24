import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { CedarInputLinkComponent } from './cedar-input-link.component';

describe('link field feedback', () => {
  let injector: ReturnType<typeof Injector.create>;
  afterEach(() => injector?.destroy());

  const makeComponent = (): CedarInputLinkComponent => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    injector = Injector.create({
      providers: [
        { provide: ActiveComponentRegistryService, useValue: registry },
        { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputLinkComponent(new FormBuilder(), {} as ComponentDataService, registry),
    );
    component.componentToRender = {
      path: ['link'],
      basicInfo: { inputType: InputType.link },
      valueInfo: { requiredValue: true, regex: null },
    } as unknown as FieldComponent;
    component.ngOnInit();
    return component;
  };

  it('reveals the unanswered requirement only when the user reaches the field', () => {
    const component = makeComponent();
    expect(component.inputValueControl.hasError('required')).toBe(true);
    expect(component.inputValueControl.touched).toBe(false);

    component.markRevealed();

    expect(component.inputValueControl.touched).toBe(true);
    expect(component.inputValueControl.hasError('required')).toBe(true);
  });

  it('updates the character count when a value is loaded and cleared', () => {
    const component = makeComponent();
    expect(component.getCharCountHint()).toBe('0');
    component.setCurrentValue('https://example.org');
    expect(component.getCharCountHint()).toBe('19');
    component.setCurrentValue(null);
    expect(component.getCharCountHint()).toBe('0');
  });
});
