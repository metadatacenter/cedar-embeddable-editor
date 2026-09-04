import { ChangeDetectorRef, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HtmlDetectService } from '../../../shared/service/html-detect.service';
import { CedarInputTextComponent } from './cedar-input-text.component';

function textFieldWith(valueInfo: { minLength: number | null; maxLength: number | null }): CedarInputTextComponent {
  const registry = {
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
  } as unknown as ActiveComponentRegistryService;
  const htmlDetect = { isHtmlString: () => false } as unknown as HtmlDetectService;
  const injector = Injector.create({
    providers: [
      { provide: UserPreferencesService, useValue: new UserPreferencesService() },
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
      { provide: DestroyRef, useValue: { onDestroy: vi.fn() } },
      { provide: ActiveComponentRegistryService, useValue: registry },
    ],
  });
  const component = runInInjectionContext(
    injector,
    () => new CedarInputTextComponent(new FormBuilder(), {} as unknown as ComponentDataService, registry, htmlDetect),
  );
  component.component = { valueInfo } as unknown as FieldComponent;
  return component;
}

describe('the character counter under a text field', () => {
  it('states a maximum on its own, with no operator standing beside nothing', () => {
    const field = textFieldWith({ minLength: null, maxLength: 15 });

    expect(field.getCharCountHint()).toBe('0 / 15');

    field.setCurrentValue('94305');

    expect(field.getCharCountHint()).toBe('5 / 15');
  });

  it('states both bounds as a range', () => {
    const field = textFieldWith({ minLength: 5, maxLength: 15 });

    expect(field.getCharCountHint()).toBe('0 / 5 .. 15');
  });

  it('leaves an unbounded maximum open', () => {
    const field = textFieldWith({ minLength: 5, maxLength: null });

    expect(field.getCharCountHint()).toBe('0 / 5 .. ∞');
  });

  it('counts alone when the template constrains no length', () => {
    const field = textFieldWith({ minLength: null, maxLength: null });

    expect(field.getCharCountHint()).toBe('0');
  });
});
