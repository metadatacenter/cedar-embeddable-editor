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
import { FieldValueValidator } from '../../../shared/validation/field-value-validator';
import { ValidationCode } from '../../../shared/validation/validation-problem.model';
import { validAbsoluteFieldIri } from '../../../shared/validation/absolute-iri';

describe('link field feedback', () => {
  let injector: ReturnType<typeof Injector.create>;
  afterEach(() => injector?.destroy());

  const makeComponent = (required = true): CedarInputLinkComponent => {
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
      valueInfo: { requiredValue: required, regex: null },
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

  /*
   * The field's notice of the report leaves a malformed link IRI to this control, so the control
   * has to carry the error the box shows for every IRI the report rejects, and for no other.
   */
  describe('an IRI the report rejects', () => {
    const rejected = [
      'example',
      'https://bad iri',
      'http:foo',
      '/relative/path',
      '#fragment',
      'urn:',
      'https://',
      ' https://example.org',
    ];
    const accepted = [
      'https://example.org/a',
      'urn:isbn:0451450523',
      'tag:example.org,2026:x',
      'mailto:someone@example.org',
      'https://example.org/ü',
      'http://[::1]/',
    ];
    const reportRejects = (component: CedarInputLinkComponent, iri: string): boolean =>
      FieldValueValidator.validate(component.component, iri, ['link']).some(
        (problem) => problem.code === ValidationCode.iriMalformed,
      );

    it.each(rejected)('marks the stored IRI %j as invalid in the box', (iri) => {
      const component = makeComponent(false);
      component.setCurrentValue(iri);

      expect(reportRejects(component, iri)).toBe(true);
      expect(validAbsoluteFieldIri(iri)).toBe(false);
      expect(component.inputValueControl.hasError('pattern')).toBe(true);
    });

    it.each(accepted)('leaves the stored IRI %j unmarked', (iri) => {
      const component = makeComponent(false);
      component.setCurrentValue(iri);

      expect(reportRejects(component, iri)).toBe(false);
      expect(validAbsoluteFieldIri(iri)).toBe(true);
      expect(component.inputValueControl.errors).toBeNull();
    });

    it('marks an IRI the user types as invalid in the box', () => {
      const component = makeComponent(false);
      component.inputValueControl.setValue('https://bad iri');

      expect(component.inputValueControl.hasError('pattern')).toBe(true);
    });
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
